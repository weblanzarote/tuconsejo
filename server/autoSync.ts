import { getAutoSyncUserIds, getIntegrationsByUser } from "./db";
import { getAutoSyncIntervalMinutes } from "./autoSyncConfig";
import { syncUserEmails } from "./emailSync";

const INITIAL_DELAY_MS = 60_000; // 1 min después del arranque

let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const userIds = await getAutoSyncUserIds();
    let usersSynced = 0;
    let totalNew = 0;
    let totalRegistry = 0;
    for (const userId of userIds) {
      try {
        const integrations = await getIntegrationsByUser(userId);
        if (!integrations.length) continue;
        const res = await syncUserEmails(userId);
        usersSynced++;
        totalNew += res.newSignals;
        totalRegistry += res.newRegistry;
      } catch (err: any) {
        console.warn(`[AutoSync] Usuario ${userId} falló:`, err?.message ?? err);
      }
    }
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    if (usersSynced > 0 || totalNew > 0 || totalRegistry > 0) {
      console.log(
        `[AutoSync] ${usersSynced} usuarios sincronizados, ${totalNew} destacados, ${totalRegistry} en registro (${elapsed}s)`
      );
    }
  } catch (err: any) {
    console.error("[AutoSync] Error global:", err?.message ?? err);
  } finally {
    running = false;
  }
}

export function startAutoSyncScheduler() {
  const intervalMin = getAutoSyncIntervalMinutes();
  const intervalMs = intervalMin * 60 * 1000;
  console.log(`[AutoSync] Programado cada ${intervalMin} min`);

  setTimeout(() => {
    runOnce();
    setInterval(runOnce, intervalMs);
  }, INITIAL_DELAY_MS);
}
