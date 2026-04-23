import { invokeLLM } from "./_core/llm";
import {
  getEmailFilterPrefs,
  getIntegrationsByUser,
  getRecentClassifierFeedbackExamples,
  insertEmailSignal,
} from "./db";
import { extractIgnoredSenderEmails, mergeEmailFilterPrefs } from "./emailFilterPrefs";
import { dispatchNotification } from "./notifications/dispatcher";
import { getProvider } from "./providers";

export interface SyncResult {
  synced: number;
  /** Nuevos correos destacados por la IA (pendientes + notificación). */
  newSignals: number;
  /** Nuevos correos guardados solo en el registro secundario (sin notificación). */
  newRegistry: number;
  errors: string[];
}

/**
 * Sincroniza correos de todas las cuentas conectadas de un usuario.
 * Usado por el endpoint `signals.sync` y por el scheduler automático.
 */
export async function syncUserEmails(userId: number): Promise<SyncResult> {
  const integrations = await getIntegrationsByUser(userId);
  if (!integrations.length) {
    return { synced: 0, newSignals: 0, newRegistry: 0, errors: [] };
  }

  const userEmailPrefs = await getEmailFilterPrefs(userId);
  const feedbackExamples = await getRecentClassifierFeedbackExamples(userId, 15);
  let classifierLearningBlock = "";
  if (feedbackExamples.length > 0) {
    const lines = feedbackExamples.map((r) => {
      const tag =
        r.classifierUserFeedback === "not_important" ? "USUARIO_DICE_NO_IMPORTANTE" : "USUARIO_CONFIRMO_IMPORTANTE";
      const prev = (r.snippet ?? "").replace(/\s+/g, " ").slice(0, 140);
      return `- [${tag}] remitente=${r.fromAddress} asunto="${(r.subject ?? "").slice(0, 80)}" vista_previa="${prev}"`;
    });
    classifierLearningBlock = `\n\nAprendizaje de correcciones anteriores del usuario (últimas ${feedbackExamples.length} marcas). Aplica esto al clasificar correos NUEVOS similares en remitente, tono o tipo:\n${lines.join("\n")}\n- Si ves USUARIO_DICE_NO_IMPORTANTE: trata patrones parecidos como ruido salvo que sea claramente distinto.\n- Si ves USUARIO_CONFIRMO_IMPORTANTE: prioriza patrones parecidos como importantes.`;
  }

  let totalSynced = 0;
  let totalNew = 0;
  let totalRegistry = 0;
  const errors: string[] = [];

  for (const integration of integrations) {
    try {
      const provider = getProvider(integration);
      const messageList = await provider.fetchRecent(integration, 30);
      if (!messageList.length) continue;

      const details = await Promise.all(
        messageList.slice(0, 30).map((m) => provider.fetchDetail(integration, m.providerMessageId).catch(() => null))
      );
      const validDetails = details.filter(Boolean) as NonNullable<typeof details[0]>[];
      if (!validDetails.length) {
        if (messageList.length > 0) {
          errors.push(
            `${integration.provider}/${integration.connectedEmail}: Se listaron ${messageList.length} mensajes pero no se pudieron leer los detalles (token o permisos).`
          );
        }
        continue;
      }
      totalSynced += validDetails.length;

      const mergedPrefs = mergeEmailFilterPrefs(userEmailPrefs, integration.emailFilterPrefs);
      const hardIgnoredSenders = new Set(extractIgnoredSenderEmails(mergedPrefs));

      const emailList = validDetails.map((d) => ({
        id: d.providerMessageId,
        subject: d.subject,
        fromEmail: d.fromAddress,
        fromDisplay: d.fromName || d.fromAddress,
        toCc: d.toCcSummary ?? "",
        snippet: d.snippet.slice(0, 200),
      }));

      const accountPrefs = mergedPrefs;
      const accountLabel = integration.label ? `${integration.label} — ${integration.connectedEmail}` : integration.connectedEmail;

      let importantIds: string[] = [];
      try {
        const filterResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Eres un filtro inteligente de emails personales. Analiza la lista de correos de la cuenta "${accountLabel}" (bandeja de ${integration.connectedEmail}) y devuelve SOLO los IDs que son importantes o requieren acción real del usuario.

Cada correo incluye fromEmail (dirección exacta del remitente), fromDisplay (nombre opcional), toCc (destinatarios Para/Cc si existen) y snippet.

Reglas:
- Las preferencias del usuario tienen PRIORIDAD ABSOLUTA sobre tu criterio por defecto. Si piden ignorar un remitente concreto (coincidencia por fromEmail, sin distinguir mayúsculas), NUNCA incluyas ese ID en "important", aunque el asunto parezca urgente o sea un formulario/oferta.
- Si el usuario pide ignorar hilos que no van dirigidos a él sino a un docente u otra persona, usa toCc y el cuerpo/snippet: si los destinatarios principales no incluyen la cuenta del usuario y el tono es respuesta de alumno a profesor, NO es importante.
- Si el usuario indica que su nombre (p. ej. Fernando o Fer) marca importancia, prioriza esos mensajes salvo que otra regla explícita diga lo contrario.
- Por defecto ignora newsletters, notificaciones automáticas, marketing, confirmaciones rutinarias y spam.
- Los correos que no marques como importantes igual quedan guardados en un registro para el usuario: si hay duda razonable (trabajo, dinero, salud, citas, trámites personales), inclúyelos en "important".

${accountPrefs ? `Preferencias del usuario (globales + esta cuenta):\n${accountPrefs}` : ""}${classifierLearningBlock}

Responde ÚNICAMENTE con JSON: {"important": ["id1", "id2"]}`,
            },
            { role: "user", content: JSON.stringify(emailList) },
          ],
          responseFormat: { type: "json_object" },
          maxTokens: 400,
        });
        const rawFilter = filterResponse.choices[0]?.message?.content;
        const raw = typeof rawFilter === "string" ? rawFilter : "{}";
        const parsed = JSON.parse(raw) as { important?: string[] };
        importantIds = parsed.important ?? [];
      } catch {
        importantIds = validDetails.slice(0, 5).map((d) => d.providerMessageId);
      }

      for (const detail of validDetails) {
        if (hardIgnoredSenders.has(detail.fromAddress.trim().toLowerCase())) continue;
        const isImportant = importantIds.includes(detail.providerMessageId);
        const inserted = await insertEmailSignal({
          userId,
          integrationId: integration.id,
          gmailMessageId: `${integration.id}:${detail.providerMessageId}`,
          subject: detail.subject,
          fromAddress: detail.fromAddress,
          fromName: detail.fromName,
          snippet: detail.snippet,
          fullBody: detail.fullBody,
          receivedAt: detail.receivedAt,
          status: isImportant ? "pending" : "low_priority",
        });
        if (!inserted) continue;
        if (isImportant) {
          totalNew++;
          await dispatchNotification({
            userId,
            kind: "email",
            title: detail.subject || "(sin asunto)",
            body: `de ${detail.fromName || detail.fromAddress}`,
            refId: inserted.id,
            dedupeKey: `email:${inserted.id}`,
          });
        } else {
          totalRegistry++;
        }
      }
    } catch (err: any) {
      errors.push(`${integration.provider}/${integration.connectedEmail}: ${err?.message ?? err}`);
    }
  }

  return { synced: totalSynced, newSignals: totalNew, newRegistry: totalRegistry, errors };
}
