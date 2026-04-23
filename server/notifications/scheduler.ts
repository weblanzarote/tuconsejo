import { getActionItemsByUser, getUserById, listNotificationSettings, upsertNotificationSettings } from "../db";
import { formatYyyyMmDdInTimeZone } from "../dateTz";
import { dispatchNotification, flushUserQueue } from "./dispatcher";

const TICK_INTERVAL_MS = 60_000; // 1 min
const INITIAL_DELAY_MS = 90_000; // 1.5 min tras arranque (después del AutoSync inicial)

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const all = await listNotificationSettings();
    if (!all.length) return;

    const now = new Date();
    const currentMinute = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const nowMs = now.getTime();

    for (const s of all) {
      if (!s.enabled || !s.telegramChatId) continue;

      // 1) Vaciar cola si toca (horario)
      // "hourly" → al minuto 0 de cada hora. "daily" → a la hora configurada (timezone del usuario).
      const user = await getUserByIdSafe(s.userId);
      const tz = user?.timezone ?? "UTC";
      const localToday = formatYyyyMmDdInTimeZone(now, tz);
      const localHm = formatLocalHm(now, tz);

      const flushReasons: ("hourly" | "daily")[] = [];
      if (s.emailFrequency === "hourly" && now.getMinutes() === 0) {
        flushReasons.push("hourly");
      }
      if (
        (s.emailFrequency === "daily" || s.taskFrequency === "daily") &&
        localHm === s.dailyDigestTime &&
        s.lastDailyDigestDate !== localToday
      ) {
        flushReasons.push("daily");
      }

      // 2) Generar recordatorios de deadline para "daily": una vez al día, al hit de digest time
      if (flushReasons.includes("daily")) {
        await enqueueDailyTaskReminders(s.userId, tz);
      }

      if (flushReasons.length) {
        await flushUserQueue(s.userId);
        if (flushReasons.includes("daily")) {
          await upsertNotificationSettings(s.userId, { lastDailyDigestDate: localToday });
        }
      }
      // silence unused-var warnings
      void currentMinute;
      void nowMs;
    }
  } catch (err: any) {
    console.error("[NotifScheduler] error:", err?.message ?? err);
  } finally {
    running = false;
  }
}

async function enqueueDailyTaskReminders(userId: number, tz: string) {
  const items = await getActionItemsByUser(userId);
  const today = formatYyyyMmDdInTimeZone(new Date(), tz);
  for (const it of items) {
    if (it.status === "completada" || it.status === "cancelada") continue;
    if (it.isArchived) continue;
    if (!it.deadline) continue;
    const deadlineStr = formatYyyyMmDdInTimeZone(new Date(it.deadline), tz);
    // Encolar si el deadline es hoy o ya pasó (sigue pendiente)
    if (deadlineStr <= today) {
      const overdue = deadlineStr < today;
      await dispatchNotification({
        userId,
        kind: "task_due",
        title: it.title,
        body: overdue ? `vencía ${deadlineStr}` : "vence hoy",
        refId: it.id,
        // 1 aviso por tarea por día
        dedupeKey: `task_due:${it.id}:${today}`,
      });
    }
  }
}

function formatLocalHm(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${h}:${m}`;
  } catch {
    return "00:00";
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
    setInterval(tick, TICK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
