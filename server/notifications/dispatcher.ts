import {
  enqueueNotification,
  getNotificationSettings,
  getPendingNotifications,
  markNotificationFailed,
  markNotificationsSent,
} from "../db";
import { type NotificationQueueRow } from "../../drizzle/schema";
import { escapeTelegramHtml, sendTelegramMessage } from "./telegram";

type NotifKind = NotificationQueueRow["kind"];

function stableHash(s: string): number {
  // Hash simple/determinista (no cripto) para rotar mensajes sin IA.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickOne(seed: string, options: string[]): string {
  if (!options.length) return "";
  return options[stableHash(seed) % options.length]!;
}

/**
 * Encola una notificación. Los correos importantes se envían al instante; las tareas respetan
 * taskFrequency y el scheduler. Modo "off" no encola.
 *
 * Se llama desde los puntos de evento (nuevo correo importante, nueva tarea, recordatorio de
 * deadline). No lanza — los fallos se registran pero no rompen la operación original.
 */
export async function dispatchNotification(params: {
  userId: number;
  kind: NotifKind;
  title: string;
  body: string;
  refId?: number;
  dedupeKey?: string;
}): Promise<void> {
  try {
    const settings = await getNotificationSettings(params.userId);
    if (!settings || !settings.enabled || !settings.telegramChatId) return;

    const freq = frequencyFor(params.kind, settings);
    if (freq === "off") return;

    const row = await enqueueNotification({
      userId: params.userId,
      kind: params.kind,
      title: params.title,
      body: params.body,
      refId: params.refId,
      dedupeKey: params.dedupeKey,
    });
    if (!row) return; // dedupe: ya existía

    // Correo importante: siempre Telegram en el acto (justo tras la sincronización que lo detectó).
    if (params.kind === "email") {
      await flushUserQueue(params.userId, ["email"]);
      return;
    }

    if (freq === "instant") {
      await flushUserQueue(params.userId);
    }
  } catch (err: any) {
    console.warn("[Notifications] dispatch falló:", err?.message ?? err);
  }
}

function frequencyFor(kind: NotifKind, s: { emailFrequency: string; taskFrequency: string }) {
  if (kind === "email") return s.emailFrequency as "instant" | "hourly" | "daily" | "off";
  return s.taskFrequency as "hourly" | "every4h" | "every8h" | "daily" | "off";
}

/**
 * Vacía la cola pendiente de un usuario: agrupa por tipo si hay más de una y manda un solo mensaje.
 * Devuelve el número de notificaciones enviadas.
 */
export async function flushUserQueue(userId: number, onlyKinds?: NotifKind[]): Promise<number> {
  const settings = await getNotificationSettings(userId);
  if (!settings?.telegramChatId || !settings.enabled) return 0;

  const pending = await getPendingNotifications(userId, onlyKinds);
  if (!pending.length) return 0;

  const message = formatDigest(pending);
  const sendRes = await sendTelegramMessage(settings.telegramChatId, message);
  if (!sendRes.ok) {
    for (const p of pending) {
      await markNotificationFailed(p.id, sendRes.error ?? "unknown error");
    }
    console.warn(`[Notifications] Envío a userId=${userId} falló: ${sendRes.error}`);
    return 0;
  }
  await markNotificationsSent(pending.map((p) => p.id));
  return pending.length;
}

function formatDigest(rows: NotificationQueueRow[]): string {
  const emails = rows.filter((r) => r.kind === "email");
  const tasksNew = rows.filter((r) => r.kind === "task_new");
  const tasksDue = rows.filter((r) => r.kind === "task_due");

  const seed = `${new Date().toISOString().slice(0, 13)}|${rows[0]?.userId ?? 0}|${rows[0]?.id ?? 0}`;
  const headerOptions = [
    "Mini empujón del Consejo: lo importante es empezar.",
    "Vamos a por una pequeña victoria hoy.",
    "Un paso pequeño ahora te ahorra estrés luego.",
    "Recordatorio amable: tu yo del futuro te lo agradecerá.",
    "Modo progreso: 10 minutos cuentan.",
    "Si lo tienes en mente, merece un hueco en tu día.",
    "Hoy toca avanzar, aunque sea un poquito.",
    "No hace falta perfecto: hace falta hecho.",
    "El secreto para avanzar es dar el primer paso.",
    "No subestimes el poder de un pequeño avance constante.",
    "Convierte esa intención en acción hoy mismo.",
    "Cada tarea completada es una carga menos en tu mente.",
    "Tu concentración de hoy es tu tranquilidad de mañana.",
    "No mires la cima, solo concéntrate en el siguiente escalón.",
    "Una mente clara empieza con una lista de tareas más corta.",
    "Hazlo ahora, a veces 'luego' se convierte en 'nunca'.",
    "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
    "Conquista el día antes de que el día te conquiste a ti.",
  ];
  const header = pickOne(seed, headerOptions);

  const parts: string[] = [];
  if (header && emails.length === 0) parts.push(`✨ <b>${escapeTelegramHtml(header)}</b>`);
  if (emails.length === 1) {
    const match = emails[0].body.match(/^\[(.*?)\]\s+(.*)/);
    let labelText = "";
    let cleanBody = emails[0].body;
    if (match) {
      labelText = ` [${match[1]}]`;
      cleanBody = match[2];
    }
    parts.push(`📧 <b>Correo importante${escapeTelegramHtml(labelText)}</b>\n${escapeTelegramHtml(emails[0].title)}\n${escapeTelegramHtml(cleanBody)}`);
  } else if (emails.length > 1) {
    parts.push(
      `📧 <b>${emails.length} correos importantes</b>\n` +
        emails
          .slice(0, 10)
          .map((e) => {
            const match = e.body.match(/^\[(.*?)\]\s+(.*)/);
            const prefix = match ? `[${match[1]}] ` : "";
            return `• ${escapeTelegramHtml(prefix + e.title)}`;
          })
          .join("\n")
    );
  }

  if (tasksNew.length === 1) {
    parts.push(`✅ <b>Nueva tarea</b>\n${escapeTelegramHtml(tasksNew[0].title)}${tasksNew[0].body ? "\n" + escapeTelegramHtml(tasksNew[0].body) : ""}`);
  } else if (tasksNew.length > 1) {
    parts.push(
      `✅ <b>${tasksNew.length} nuevas tareas</b>\n` +
        tasksNew
          .slice(0, 10)
          .map((t) => `• ${escapeTelegramHtml(t.title)}`)
          .join("\n")
    );
  }

  if (tasksDue.length) {
    const dueIntroOptions = [
      "Elige una y desbloquea tu día.",
      "¿Cuál te quitas primero para respirar mejor?",
      "Una de estas resuelta y ya ganaste inercia.",
      "Si haces solo una cosa hoy, que sea una de estas.",
      "Ponte un temporizador de 10 minutos y empieza.",
    ];
    const dueIntro = pickOne(`${seed}|due|${tasksDue.length}`, dueIntroOptions);
    parts.push(
      `⏰ <b>${tasksDue.length} tarea${tasksDue.length === 1 ? "" : "s"} pendiente${tasksDue.length === 1 ? "" : "s"}</b>\n` +
        `${escapeTelegramHtml(dueIntro)}\n` +
        tasksDue
          .slice(0, 10)
          .map((t) => `• ${escapeTelegramHtml(t.title)}${t.body ? " — " + escapeTelegramHtml(t.body) : ""}`)
          .join("\n")
    );
  }

  return parts.join("\n\n") || "Notificación";
}
