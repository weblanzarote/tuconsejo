import { describe, expect, it } from "vitest";
import { parseMechanicalRules, resolveMechanicalEmailImportance } from "./emailFilterPrefs";

describe("resolveMechanicalEmailImportance", () => {
  const base = {
    subject: "Hola",
    snippet: "texto",
    fullBody: "",
  };

  it("fuerza importante si el remitente empieza por el prefijo indicado", () => {
    const rules = parseMechanicalRules("FORZAR_IMPORTANTE_REMITENTE_PREFIJO:boss@");
    expect(
      resolveMechanicalEmailImportance({ ...base, fromAddress: "boss@empresa.com" }, rules)
    ).toBe("force_important");
    expect(
      resolveMechanicalEmailImportance({ ...base, fromAddress: "other@empresa.com" }, rules)
    ).toBe("use_llm");
  });

  it("fuerza no importante si el remitente empieza por el prefijo indicado", () => {
    const rules = parseMechanicalRules("IGNORAR_REMITENTE_PREFIJO:noreply@");
    expect(
      resolveMechanicalEmailImportance({ ...base, fromAddress: "noreply@shop.com" }, rules)
    ).toBe("force_not_important");
  });

  it("las reglas de importante tienen prioridad sobre ignorar remitente", () => {
    const rules = parseMechanicalRules(
      "FORZAR_IMPORTANTE_REMITENTE_PREFIJO:vip@\nIGNORAR_REMITENTE_PREFIJO:vip@"
    );
    expect(resolveMechanicalEmailImportance({ ...base, fromAddress: "vip@x.com" }, rules)).toBe(
      "force_important"
    );
  });
});
