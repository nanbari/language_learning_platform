import { describe, expect, it } from "vitest";
import { calendarRange, placeDay } from "@/lib/classCalendar";
import type { ClassSchedule } from "@/lib/classes";

const slot = (start: string, minutes = 60, day = 3): ClassSchedule => ({ day, start, minutes });

describe("calendarRange", () => {
  it("sans horaire : 9 h – 18 h", () => {
    expect(calendarRange([])).toEqual({ from: 9 * 60, to: 18 * 60 });
  });

  it("englobe tous les cours, arrondi à l'heure", () => {
    expect(calendarRange([slot("09:30", 60), slot("16:15", 90)])).toEqual({ from: 9 * 60, to: 18 * 60 });
  });

  it("garde au moins quatre heures, sans dépasser minuit", () => {
    expect(calendarRange([slot("14:00", 60)])).toEqual({ from: 14 * 60, to: 18 * 60 });
    expect(calendarRange([slot("22:00", 60)])).toEqual({ from: 20 * 60, to: 24 * 60 });
  });
});

describe("placeDay", () => {
  it("cours qui se suivent : un seul couloir, dans l'ordre des heures", () => {
    const placed = placeDay([{ item: "b", schedule: slot("15:00") }, { item: "a", schedule: slot("14:00") }]);
    expect(placed.map((p) => [p.item, p.lane, p.lanes])).toEqual([["a", 0, 1], ["b", 0, 1]]);
  });

  it("cours qui se chevauchent : côte à côte", () => {
    const placed = placeDay([
      { item: "a", schedule: slot("14:00", 90) },
      { item: "b", schedule: slot("14:30", 60) },
      { item: "c", schedule: slot("17:00", 60) },
    ]);
    expect(placed.map((p) => [p.item, p.lane, p.lanes])).toEqual([["a", 0, 2], ["b", 1, 2], ["c", 0, 1]]);
  });

  it("un couloir libéré est réutilisé dans le même groupe", () => {
    const placed = placeDay([
      { item: "long", schedule: slot("09:00", 180) },
      { item: "matin", schedule: slot("09:00", 60) },
      { item: "suite", schedule: slot("10:00", 60) },
    ]);
    expect(placed.map((p) => [p.item, p.lane, p.lanes])).toEqual([["long", 0, 2], ["matin", 1, 2], ["suite", 1, 2]]);
  });
});
