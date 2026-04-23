import * as XLSX from "xlsx";
import { TRPCError } from "@trpc/server";

export type ParsedBankMovement = {
  bookedDate: string;
  valueDate: string;
  description: string;
  extra: string;
  amount: number;
  balance: number | null;
};

export type CaixaXlsParseResult = {
  format: "caixa_xls";
  accountHint: string | null;
  movements: ParsedBankMovement[];
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Convierte fecha en serie Excel (CaixaBank .xls) a YYYY-MM-DD */
export function excelSerialToIsoDate(serial: unknown): string | null {
  if (typeof serial !== "number" || !Number.isFinite(serial) || serial < 20000 || serial > 80000) {
    return null;
  }
  const p = XLSX.SSF.parse_date_code(serial);
  if (!p || !p.y) return null;
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function cellToNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.replace(/\s/g, "").replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Detecta export CaixaBank: hoja con cabecera Fecha / Fecha valor / Movimiento / … */
export function parseCaixaBankMovimientosXls(buffer: Buffer): CaixaXlsParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No se pudo leer el archivo. ¿Es un .xls de movimientos de CaixaBank?",
    });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El Excel no contiene hojas." });
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

  let accountHint: string | null = null;
  const firstCell = rows[0]?.[0];
  if (firstCell != null) {
    const s = String(firstCell);
    const m = s.match(/ES\d{2}[\s\d]{10,}/i);
    if (m) accountHint = m[0].replace(/\s+/g, " ").trim();
  }

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const a = cellToString(r[0]).toLowerCase();
    const b = cellToString(r[1]).toLowerCase();
    if (a === "fecha" && b.includes("valor")) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "No reconozco el formato: falta la fila de cabecera (Fecha, Fecha valor, Movimiento…). Exporta movimientos desde CaixaBankNow en .xls.",
    });
  }

  const movements: ParsedBankMovement[] = [];
  const maxRows = 8000;

  for (let i = headerRowIdx + 1; i < rows.length && movements.length < maxRows; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length < 5) continue;

    const booked = excelSerialToIsoDate(r[0]);
    const valueD = excelSerialToIsoDate(r[1]);
    const desc = cellToString(r[2]);
    const extra = cellToString(r[3]);
    const amount = cellToNumber(r[4]);
    const balance = cellToNumber(r[5]);

    if (!booked && !desc && amount == null) continue;
    if (!booked) continue;
    if (amount == null) continue;

    movements.push({
      bookedDate: booked,
      valueDate: valueD ?? booked,
      description: desc || "(sin concepto)",
      extra,
      amount,
      balance,
    });
  }

  if (movements.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No se encontraron filas de movimientos válidas en el archivo.",
    });
  }

  return { format: "caixa_xls", accountHint, movements };
}
