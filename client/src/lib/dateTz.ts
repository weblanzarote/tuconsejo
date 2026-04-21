/** Fecha civil YYYY-MM-DD en zona IANA (alineada con el servidor). */
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

export function getDetectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
