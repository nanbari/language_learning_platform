import { describe, it, expect } from "vitest";
import { parseStaffUpdate, staffUpdateError } from "./staff";

const ME = "123e4567-e89b-12d3-a456-426614174000";
const OTHER = "223e4567-e89b-12d3-a456-426614174000";

describe("parseStaffUpdate", () => {
  it("accepte un id uuid et un booléen", () => {
    expect(parseStaffUpdate({ id: OTHER, isAdmin: true })).toEqual({ ok: true, value: { id: OTHER, isAdmin: true } });
  });

  it("refuse un id ou une valeur invalides", () => {
    expect(parseStaffUpdate({ id: "nope", isAdmin: true }).ok).toBe(false);
    expect(parseStaffUpdate({ id: OTHER, isAdmin: "oui" }).ok).toBe(false);
    expect(parseStaffUpdate(null).ok).toBe(false);
  });
});

describe("staffUpdateError", () => {
  it("interdit de se retirer son propre droit admin", () => {
    expect(staffUpdateError({ id: ME, isAdmin: false }, ME)).toMatch(/propre droit/);
  });

  it("permet le reste", () => {
    expect(staffUpdateError({ id: ME, isAdmin: true }, ME)).toBeNull();
    expect(staffUpdateError({ id: OTHER, isAdmin: false }, ME)).toBeNull();
    expect(staffUpdateError({ id: OTHER, isAdmin: true }, ME)).toBeNull();
  });
});
