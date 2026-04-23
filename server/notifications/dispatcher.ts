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

/**
 * Encola una notificación. Si el usuario la tiene en modo "instant", se intenta enviar en el acto;
 * si está en "hourly" / "daily" / "off", queda en la cola para que el scheduler la procese.
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

    if (freq === "instant") {
      await flushUserQueue(params.userId);
    }
  } catch (err: any) {
    console.warn("[Notifications] dispatch falló:", err?.message ?? err);
  }
}

function frequencyFor(kind: NotifKind, s: { emailFrequency: string; taskFrequency: string }) {
  if (kind === "email") return s.emailFrequency as "instant" | "hourly" | "daily" | "off";
  return s.taskFrequency as "instant" | "daily" | "off";
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

  const parts: string[] = [];
  if (emails.length === 1) {
    parts.push(`📧 <b>Correo importante</b>\n${escapeTelegramHtml(emails[0].title)}\n${escapeTelegramHtml(emails[0].body)}`);
  } else if (emails.length > 1) {
    parts.push(
      `📧 <b>${emails.length} correos importantes</b>\n` +
        emails
          .slice(0, 10)
          .map((e) => `• ${escapeTelegramHtml(e.title)}`)
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
    parts.push(
      `⏰ <b>${tasksDue.length} tarea${tasksDue.length === 1 ? "" : "s"} pendiente${tasksDue.length === 1 ? "" : "s"}</b>\n` +
        tasksDue
          .slice(0, 10)
          .map((t) => `• ${escapeTelegramHtml(t.title)}${t.body ? " — " + escapeTelegramHtml(t.body) : ""}`)
          .join("\n")
    );
  }

  return parts.join("\n\n") || "Notificación";
}
