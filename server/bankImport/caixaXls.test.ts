import { describe, it, expect } from "vitest";
import { excelSerialToIsoDate } from "./caixaXls";

describe("excelSerialToIsoDate", () => {
  it("convierte serie CaixaBank a ISO", () => {
    expect(excelSerialToIsoDate(46135)).toBe("2026-04-23");
  });
});
