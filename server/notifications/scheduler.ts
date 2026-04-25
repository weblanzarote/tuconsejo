import { getActionItemsByUser, getUserById, listNotificationSettings, upsertNotificationSettings } from "../db";
import { formatYyyyMmDdInTimeZone } from "../dateTz";
import { dispatchNotification, flushUserQueue } from "./dispatcher";

const TICK_INTERVAL_MS = 60_000; // 1 min
const INITIAL_DELAY_MS = 90_000; // 1.5 min tras arranque

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const all = await listNotificationSettings();
    if (!all.length) return;

    const now = new Date();

    for (const s of all) {
      if (!s.enabled || !s.telegramChatId) continue;

      const user = await getUserByIdSafe(s.userId);
      const tz = user?.timezone ?? "UTC";
      const { hh, mm, date: localDate } = getLocalHmD(now, tz);
      const localHm = `${hh}:${mm}`;
      const hour = parseInt(hh, 10);
      const minute = parseInt(mm, 10);

      // ── Correos ───────────────────────────────────────────────────────────
      //   Los importantes se vacían al encolarse (dispatcher). hourly/daily solo
      //   cubren avisos antiguos pendientes o fallos puntuales.
      const shouldFlushEmails =
        (s.emailFrequency === "hourly" && minute === 0) ||
        (s.emailFrequency === "daily" &&
          localHm === s.dailyDigestTime &&
          s.lastDailyDigestDate !== localDate);

      // ── Tareas ────────────────────────────────────────────────────────────
      //   hourly  → al minuto 0 de cada hora.
      //   every4h → a las 0, 4, 8, 12, 16, 20 local (minuto 0).
      //   every8h → a las 0, 8, 16 local (minuto 0).
      //   daily   → a la hora del digest.
      const shouldFlushTasks =
        (s.taskFrequency === "hourly" && minute === 0) ||
        (s.taskFrequency === "every4h" && minute === 0 && hour % 4 === 0) ||
        (s.taskFrequency === "every8h" && minute === 0 && hour % 8 === 0) ||
        (s.taskFrequency === "daily" &&
          localHm === s.dailyDigestTime &&
          s.lastDailyDigestDate !== localDate);

      if (shouldFlushTasks) {
        await enqueueTaskReminders(s.userId, tz, `${localDate}T${hh}`);
      }

      if (shouldFlushEmails || shouldFlushTasks) {
        await flushUserQueue(s.userId);
        // Marcar el digest diario para no duplicarlo el mismo día
        const dailyFired =
          (s.emailFrequency === "daily" && localHm === s.dailyDigestTime) ||
          (s.taskFrequency === "daily" && localHm === s.dailyDigestTime);
        if (dailyFired && s.lastDailyDigestDate !== localDate) {
          await upsertNotificationSettings(s.userId, { lastDailyDigestDate: localDate });
        }
      }
    }
  } catch (err: any) {
    console.error("[NotifScheduler] error:", err?.message ?? err);
  } finally {
    running = false;
  }
}

function scheduleAlignedTick() {
  // Alinea el scheduler al borde de minuto real para que condiciones como `minute === 0`
  // funcionen siempre, independientemente de cuándo arrancó el proceso.
  const now = Date.now();
  const toNextMinute = TICK_INTERVAL_MS - (now % TICK_INTERVAL_MS);
  const delayMs = Math.max(250, toNextMinute + 50); // pequeño margen para evitar drift por jitter
  setTimeout(async () => {
    await tick();
    scheduleAlignedTick();
  }, delayMs);
}

async function enqueueTaskReminders(userId: number, tz: string, cycleKey: string) {
  const items = await getActionItemsByUser(userId);
  const today = formatYyyyMmDdInTimeZone(new Date(), tz);
  for (const it of items) {
    if (it.status === "completada" || it.status === "cancelada") continue;
    if (it.isArchived) continue;
    // 1) Si hay deadline y es hoy o vencida → recordatorio "due".
    // 2) Si no hay deadline → también recordatorio, pero con texto "pendiente" (sin fecha).
    if (it.deadline) {
      const deadlineStr = formatYyyyMmDdInTimeZone(new Date(it.deadline), tz);
      if (deadlineStr <= today) {
        const overdue = deadlineStr < today;
        await dispatchNotification({
          userId,
          kind: "task_due",
          title: it.title,
          body: overdue ? `vencía ${deadlineStr}` : "vence hoy",
          refId: it.id,
          // Un aviso por tarea y por ciclo (hora local YYYY-MM-DDTHH)
          dedupeKey: `task_due:${it.id}:${cycleKey}`,
        });
      }
      continue;
    }

    await dispatchNotification({
      userId,
      kind: "task_due",
      title: it.title,
      body: "pendiente (sin fecha límite)",
      refId: it.id,
      // Un aviso por tarea y por ciclo (hora local YYYY-MM-DDTHH)
      dedupeKey: `task_due:${it.id}:${cycleKey}:nodl`,
    });
  }
}

function getLocalHmD(date: Date, tz: string): { hh: string; mm: string; date: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const mo = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const mi = parts.find((p) => p.type === "minute")?.value ?? "00";
    // Intl a veces devuelve "24" en vez de "00" para medianoche
    const hhNorm = h === "24" ? "00" : h;
    return { hh: hhNorm, mm: mi, date: `${y}-${mo}-${d}` };
  } catch {
    return { hh: "00", mm: "00", date: "1970-01-01" };
  }
}

async function getUserByIdSafe(id: number) {
  try {
    return await getUserById(id);
  } catch {
    return null;
  }
}

export function startNotificationScheduler() {
  console.log("[NotifScheduler] Programado cada 1 min");
  setTimeout(() => {
    tick();
    scheduleAlignedTick();
  }, INITIAL_DELAY_MS);
}
