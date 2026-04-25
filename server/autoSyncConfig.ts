/** Intervalo mínimo de sincronización automática de correos (minutos). */
const MIN_INTERVAL_MIN = 5;

/**
 * Minutos entre cada revisión automática del buzón (variable AUTO_SYNC_INTERVAL_MIN en .env).
 * Por defecto 15; no baja de 5 para no saturar APIs de Google/Microsoft.
 */
export function getAutoSyncIntervalMinutes(): number {
  const raw = parseInt(process.env.AUTO_SYNC_INTERVAL_MIN ?? "15", 10);
  if (!Number.isFinite(raw)) return MIN_INTERVAL_MIN;
  return Math.max(MIN_INTERVAL_MIN, raw);
}
