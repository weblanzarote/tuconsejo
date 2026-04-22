import { invokeLLM } from "./_core/llm";
import {
  getEmailFilterPrefs,
  getIntegrationsByUser,
  getRecentClassifierFeedbackExamples,
  insertEmailSignal,
} from "./db";
import { getProvider } from "./providers";

export interface SyncResult {
  synced: number;
  newSignals: number;
  errors: string[];
}

/**
 * Sincroniza correos de todas las cuentas conectadas de un usuario.
 * Usado por el endpoint `signals.sync` y por el scheduler automático.
 */
export async function syncUserEmails(userId: number): Promise<SyncResult> {
  const integrations = await getIntegrationsByUser(userId);
  if (!integrations.length) {
    return { synced: 0, newSignals: 0, errors: [] };
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
      if (!validDetails.length) continue;
      totalSynced += validDetails.length;

      const emailList = validDetails.map((d) => ({
        id: d.providerMessageId,
        subject: d.subject,
        from: d.fromName || d.fromAddress,
        snippet: d.snippet.slice(0, 200),
      }));

      const accountPrefs = integration.emailFilterPrefs?.trim() || userEmailPrefs || "";
      const accountLabel = integration.label ? `${integration.label} — ${integration.connectedEmail}` : integration.connectedEmail;

      let importantIds: string[] = [];
      try {
        const filterResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Eres un filtro inteligente de emails personales. Analiza la lista de correos de la cuenta "${accountLabel}" y devuelve SOLO los IDs de los que son importantes o requieren acción real del usuario. Ignora newsletters, notificaciones automáticas, marketing, confirmaciones de compra rutinarias y spam.${accountPrefs ? ` Preferencias del usuario para esta cuenta: ${accountPrefs}` : ""}${classifierLearningBlock} Responde ÚNICAMENTE con JSON: {"important": ["id1", "id2"]}`,
            },
            { role: "user", content: JSON.stringify(emailList) },
          ],
          responseFormat: { type: "json_object" },
          maxTokens: 300,
        });
        const rawFilter = filterResponse.choices[0]?.message?.content;
        const raw = typeof rawFilter === "string" ? rawFilter : "{}";
        const parsed = JSON.parse(raw) as { important?: string[] };
        importantIds = parsed.important ?? [];
      } catch {
        importantIds = validDetails.slice(0, 5).map((d) => d.providerMessageId);
      }

      for (const detail of validDetails) {
        if (!importantIds.includes(detail.providerMessageId)) continue;
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
          status: "pending",
        });
        if (inserted) totalNew++;
      }
    } catch (err: any) {
      errors.push(`${integration.provider}/${integration.connectedEmail}: ${err?.message ?? err}`);
    }
  }

  return { synced: totalSynced, newSignals: totalNew, errors };
}
