import { describe, expect, it } from "vitest";
import { isLive, LIVE_MAX_HOURS, MAX_CLASS_NAME, parseClassUpdate, parseNewClass } from "./classes";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("parseNewClass", () => {
  it("nettoie le nom", () => {
    expect(parseNewClass({ name: "  CP   du mardi " })).toEqual({ ok: true, value: { name: "CP du mardi" } });
  });

  it("refuse un nom vide ou trop long", () => {
    expect(parseNewClass({ name: "   " }).ok).toBe(false);
    expect(parseNewClass({ name: "x".repeat(MAX_CLASS_NAME + 1) }).ok).toBe(false);
    expect(parseNewClass(null).ok).toBe(false);
  });
});

describe("parseClassUpdate", () => {
  it("accepte un nom, des élèves, ou les deux, et dédoublonne", () => {
    expect(parseClassUpdate({ studentIds: [A, B, A] })).toEqual({ ok: true, value: { studentIds: [A, B] } });
    expect(parseClassUpdate({ name: "CE1", studentIds: [] })).toEqual({ ok: true, value: { name: "CE1", studentIds: [] } });
  });

  it("refuse des identifiants invalides ou un corps vide", () => {
    expect(parseClassUpdate({ studentIds: ["pas-un-uuid"] }).ok).toBe(false);
    expect(parseClassUpdate({ studentIds: A }).ok).toBe(false);
    expect(parseClassUpdate({}).ok).toBe(false);
  });
});

describe("isLive", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");

  it("est vrai pour un cours lancé récemment", () => {
    expect(isLive("salon", "2026-10-16T11:00:00Z", now)).toBe(true);
  });

  it("est faux sans salon ou après la durée maximale", () => {
    expect(isLive(null, "2026-10-16T11:00:00Z", now)).toBe(false);
    expect(isLive("salon", new Date(now - (LIVE_MAX_HOURS + 1) * 3600_000).toISOString(), now)).toBe(false);
  });
});
