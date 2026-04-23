import type { ParsedBankMovement } from "./bankImport/caixaXls";
import { getBankImportState, getBankMovementsForUser } from "./db";

/** Resumen compacto de movimientos para el system prompt (principalmente economía). */
export function buildFinanceAdvisorContext(params: {
  accountHint: string | null;
  movements: ParsedBankMovement[];
  maxLines?: number;
}): string {
  const max = params.maxLines ?? 55;
  const sorted = [...params.movements].sort((a, b) => (a.bookedDate < b.bookedDate ? -1 : a.bookedDate > b.bookedDate ? 1 : 0));
  const recent = sorted.slice(-max);

  const income = sorted.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const expense = sorted.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
  const lastBal = sorted.length ? sorted[sorted.length - 1].balance : null;

  const lines: string[] = [];
  lines.push("EXTRACTO IMPORTADO (CaixaBank .xls, uso interno del consejo)");
  if (params.accountHint) lines.push(`Cuenta (IBAN indicado en export): ${params.accountHint}`);
  lines.push(
    `Resumen del fichero: ${sorted.length} movimiento(s). Gastos netos (suma importes negativos): ${expense.toFixed(2)} €. Ingresos (suma positivos): ${income.toFixed(2)} €.`
  );
  if (lastBal != null && Number.isFinite(lastBal)) {
    lines.push(`Último saldo mostrado en el extracto: ${lastBal.toFixed(2)} €.`);
  }
  lines.push("Movimientos (más recientes al final):");
  for (const m of recent) {
    const extra = m.extra ? ` | ${m.extra.slice(0, 80)}` : "";
    lines.push(
      `${m.bookedDate} | ${m.description.slice(0, 72)}${extra} | ${m.amount.toFixed(2)} €${m.balance != null ? ` | saldo ${m.balance.toFixed(2)}` : ""}`
    );
  }
  if (sorted.length > max) {
    lines.push(`(… ${sorted.length - max} movimiento(s) más antiguos omitidos por brevedad)`);
  }
  return lines.join("\n");
}

/** Carga movimientos guardados y genera el bloque de texto para los asesores (o null si no hay import). */
export async function loadFinanceAdvisorBlock(userId: number): Promise<string | null> {
  const [state, rows] = await Promise.all([getBankImportState(userId), getBankMovementsForUser(userId)]);
  if (!state || rows.length === 0) return null;
  const movements: ParsedBankMovement[] = rows.map((r) => ({
    bookedDate: r.bookedDate,
    valueDate: r.valueDate ?? r.bookedDate,
    description: r.description,
    extra: r.extra ?? "",
    amount: r.amount,
    balance: r.balance,
  }));
  return buildFinanceAdvisorContext({
    accountHint: state.accountHint,
    movements,
  });
}
