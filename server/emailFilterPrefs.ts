/**
 * Utilidades para combinar preferencias de filtrado y detectar remitentes
 * que el usuario pidió ignorar explícitamente (refuerzo además del LLM).
 *
 * Reglas mecánicas: líneas en el texto de preferencias con formato fijo
 * (IGNORAR_… / FORZAR_…) aplicadas sin IA; cada usuario define las suyas.
 */

const IGNORE_NEAR_EMAIL =
  /\b(ignora|ignorar|excluye|excluir|no\s+(quiero|muestres|mostrar)|omitir|no\s+importan?|filtra\s+fuera|descarta|block|ban)\b/i;

const EMAIL_IN_TEXT = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

/** Línea de regla mecánica: CLAVE:valor (la clave va al inicio de la línea). */
const MECHANICAL_LINE =
  /^\s*(IGNORAR_ASUNTO_PREFIJO|IGNORAR_ASUNTO_CONTIENE|IGNORAR_CUERPO_CONTIENE|IGNORAR_CUERPO_RE|IGNORAR_REMITENTE_PREFIJO|FORZAR_IMPORTANTE_CONTIENE|FORZAR_IMPORTANTE_SI_RE|FORZAR_IMPORTANTE_REMITENTE_PREFIJO)\s*:\s*(.*)$/i;

function normalizeSubjectForPrefix(subject: string): string {
  return subject.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Quita Re:/Fwd: repetidos para comparar plantillas de asunto. */
function stripReplyPrefixesForMatching(subject: string): string {
  let s = normalizeSubjectForPrefix(subject);
  for (let i = 0; i < 12; i++) {
    const next = s.replace(/^(re|fw|fwd)\s*:\s*/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

function subjectMatchesUserPrefix(subject: string, prefixRule: string): boolean {
  const p = normalizeSubjectForPrefix(prefixRule);
  if (!p) return false;
  const flat = normalizeSubjectForPrefix(subject);
  const stripped = stripReplyPrefixesForMatching(subject);
  const withoutRe = p.replace(/^re:\s*/i, "").trim();
  return (
    flat.startsWith(p) ||
    stripped.startsWith(p) ||
    (withoutRe.length > 0 && stripped.startsWith(withoutRe))
  );
}

function tryParseSlashRegex(value: string): RegExp | null {
  const v = value.trim();
  const m = v.match(/^\/([\s\S]*)\/([gimsuy]*)$/);
  if (!m) return null;
  try {
    return new RegExp(m[1], m[2] ?? "");
  } catch {
    return null;
  }
}

export interface ParsedMechanicalRules {
  ignoreSubjectPrefixes: string[];
  ignoreSubjectContains: string[];
  ignoreSenderPrefixes: string[];
  ignoreBodyContains: string[];
  ignoreBodyRes: RegExp[];
  forceImportantContains: string[];
  forceImportantSenderPrefixes: string[];
  forceImportantRes: RegExp[];
}

export function parseMechanicalRules(prefsText: string): ParsedMechanicalRules {
  const out: ParsedMechanicalRules = {
    ignoreSubjectPrefixes: [],
    ignoreSubjectContains: [],
    ignoreSenderPrefixes: [],
    ignoreBodyContains: [],
    ignoreBodyRes: [],
    forceImportantContains: [],
    forceImportantSenderPrefixes: [],
    forceImportantRes: [],
  };
  for (const rawLine of prefsText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(MECHANICAL_LINE);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const val = (m[2] ?? "").trim();
    if (!val) continue;
    switch (key) {
      case "IGNORAR_ASUNTO_PREFIJO":
        out.ignoreSubjectPrefixes.push(val);
        break;
      case "IGNORAR_ASUNTO_CONTIENE":
        out.ignoreSubjectContains.push(val);
        break;
      case "IGNORAR_REMITENTE_PREFIJO":
        out.ignoreSenderPrefixes.push(val);
        break;
      case "IGNORAR_CUERPO_CONTIENE":
        out.ignoreBodyContains.push(val);
        break;
      case "IGNORAR_CUERPO_RE": {
        const re = tryParseSlashRegex(val);
        if (re) out.ignoreBodyRes.push(re);
        break;
      }
      case "FORZAR_IMPORTANTE_CONTIENE":
        out.forceImportantContains.push(val);
        break;
      case "FORZAR_IMPORTANTE_REMITENTE_PREFIJO":
        out.forceImportantSenderPrefixes.push(val);
        break;
      case "FORZAR_IMPORTANTE_SI_RE": {
        const re = tryParseSlashRegex(val);
        if (re) out.forceImportantRes.push(re);
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** Quita del texto lo que solo sirve para reglas mecánicas, para no saturar al modelo con líneas técnicas. */
export function stripMechanicalLinesForLLM(prefsText: string): string {
  const lines = prefsText.split("\n");
  const kept: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      kept.push(raw);
      continue;
    }
    if (t.startsWith("#")) {
      kept.push(raw);
      continue;
    }
    if (MECHANICAL_LINE.test(t)) continue;
    kept.push(raw);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type MechanicalImportance = "use_llm" | "force_important" | "force_not_important";

function fromAddressMatchesPrefix(fromAddress: string, prefixRule: string): boolean {
  const from = fromAddress.trim().toLowerCase();
  const p = prefixRule.trim().toLowerCase();
  if (!from || !p) return false;
  return from.startsWith(p);
}

export function resolveMechanicalEmailImportance(
  opts: {
    fromAddress: string;
    subject: string;
    snippet: string;
    fullBody: string | null | undefined;
  },
  rules: ParsedMechanicalRules
): MechanicalImportance {
  const bodySample = `${opts.snippet}\n${(opts.fullBody ?? "").slice(0, 2500)}`;
  const combinedForForce = `${opts.subject}\n${bodySample}`.replace(/\s+/g, " ");

  for (const c of rules.forceImportantContains) {
    const needle = c.trim().toLowerCase();
    if (needle && combinedForForce.toLowerCase().includes(needle)) {
      return "force_important";
    }
  }
  for (const pre of rules.forceImportantSenderPrefixes) {
    if (fromAddressMatchesPrefix(opts.fromAddress, pre)) return "force_important";
  }
  for (const re of rules.forceImportantRes) {
    try {
      if (re.test(combinedForForce)) return "force_important";
    } catch {
      /* regex inválida en runtime */
    }
  }

  const flatSub = normalizeSubjectForPrefix(opts.subject);
  for (const prefix of rules.ignoreSubjectPrefixes) {
    if (subjectMatchesUserPrefix(opts.subject, prefix)) return "force_not_important";
  }
  for (const sub of rules.ignoreSubjectContains) {
    const n = normalizeSubjectForPrefix(sub);
    if (n && flatSub.includes(n)) return "force_not_important";
  }
  for (const pre of rules.ignoreSenderPrefixes) {
    if (fromAddressMatchesPrefix(opts.fromAddress, pre)) return "force_not_important";
  }

  const bodyLow = bodySample.toLowerCase();
  for (const sub of rules.ignoreBodyContains) {
    const n = sub.trim().toLowerCase();
    if (n && bodyLow.includes(n)) return "force_not_important";
  }
  for (const re of rules.ignoreBodyRes) {
    try {
      if (re.test(bodySample)) return "force_not_important";
    } catch {
      /* inválida */
    }
  }

  return "use_llm";
}

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

export function mergeHardIgnoredSenders(prefsText: string): Set<string> {
  return new Set(extractIgnoredSenderEmails(prefsText));
}
