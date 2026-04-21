/**
 * Fecha civil YYYY-MM-DD en una zona IANA (misma lógica que debe usar el cliente para el diario).
 */
export function formatYyyyMmDdInTimeZone(date: Date, timeZone: string): string {
  const tz = timeZone?.trim() || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !d) throw new Error("missing parts");
    return `${y}-${m}-${d}`;
  } catch {
    return formatYyyyMmDdInTimeZone(date, "UTC");
  }
}
