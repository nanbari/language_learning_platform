import { describe, expect, it } from "vitest";
import { formatSchedule, isLive, LIVE_MAX_HOURS, MAX_CLASS_NAME, parseClassUpdate, parseNewClass, scheduleFromRow } from "@/lib/classes";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("parseNewClass", () => {
  it("nettoie le nom", () => {
    expect(parseNewClass({ name: "  CP   du mardi " })).toEqual({ ok: true, value: { name: "CP du mardi", schedule: null } });
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

describe("horaire d'une classe", () => {
  const WED = { day: 3, start: "14:00", minutes: 60 };

  it("accepte un créneau à la création et à la modification ; null le retire", () => {
    expect(parseNewClass({ name: "CP", schedule: WED })).toEqual({ ok: true, value: { name: "CP", schedule: WED } });
    expect(parseClassUpdate({ schedule: WED })).toEqual({ ok: true, value: { schedule: WED } });
    expect(parseClassUpdate({ schedule: null })).toEqual({ ok: true, value: { schedule: null } });
  });

  it("refuse un jour, une heure ou une durée impossibles, et un cours qui dépasse minuit", () => {
    for (const bad of [
      { ...WED, day: 0 }, { ...WED, day: 8 }, { ...WED, day: "3" },
      { ...WED, start: "24:00" }, { ...WED, start: "9:00" }, { ...WED, start: "14h" },
      { ...WED, minutes: 10 }, { ...WED, minutes: 481 }, { ...WED, minutes: 60.5 },
      { ...WED, start: "23:30" }, "mercredi", [],
    ]) {
      expect(parseClassUpdate({ schedule: bad }).ok).toBe(false);
    }
  });

  it("se lit en base (heure avec ou sans secondes) ; incomplet ou incohérent = sans horaire", () => {
    expect(scheduleFromRow({ schedule_day: 3, schedule_start: "14:00:00", schedule_minutes: 60 })).toEqual(WED);
    expect(scheduleFromRow({ schedule_day: 3, schedule_start: null, schedule_minutes: 60 })).toBeNull();
    expect(scheduleFromRow({ schedule_day: 9, schedule_start: "14:00", schedule_minutes: 60 })).toBeNull();
    expect(scheduleFromRow({})).toBeNull();
  });

  it("s'écrit comme on le dit", () => {
    expect(formatSchedule(WED)).toBe("Mercredi, 14 h – 15 h");
    expect(formatSchedule({ day: 6, start: "09:30", minutes: 45 })).toBe("Samedi, 9 h 30 – 10 h 15");
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
