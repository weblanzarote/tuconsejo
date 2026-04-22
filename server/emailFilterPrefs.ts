/**
 * Utilidades para combinar preferencias de filtrado y detectar remitentes
 * que el usuario pidió ignorar explícitamente (refuerzo además del LLM).
 */

const IGNORE_NEAR_EMAIL =
  /\b(ignora|ignorar|excluye|excluir|no\s+(quiero|muestres|mostrar)|omitir|no\s+importan?|filtra\s+fuera|descarta|block|ban)\b/i;

const EMAIL_IN_TEXT = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

/** Une preferencias globales y de cuenta (antes solo se usaba una u otra). */
export function mergeEmailFilterPrefs(
  globalPrefs: string | null | undefined,
  accountPrefs: string | null | undefined
): string {
  const g = globalPrefs?.trim() ?? "";
  const a = accountPrefs?.trim() ?? "";
  if (g && a) {
    return `${g}\n\n--- Preferencias específicas de esta cuenta ---\n${a}`;
  }
  return g || a;
}

/**
 * Extrae direcciones que aparecen cerca de verbos de exclusión (p. ej. "ignora ... noreply@...").
 * Refuerzo determinista: si el LLM se equivoca, igual no creamos la señal.
 */
export function extractIgnoredSenderEmails(prefsText: string): string[] {
  const t = prefsText.trim();
  if (!t) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(EMAIL_IN_TEXT.source, "gi");
  while ((m = re.exec(t)) !== null) {
    const start = Math.max(0, m.index - 120);
    const ctx = t.slice(start, m.index + m[0].length);
    if (IGNORE_NEAR_EMAIL.test(ctx)) {
      out.add(m[0].toLowerCase());
    }
  }
  return Array.from(out);
}
