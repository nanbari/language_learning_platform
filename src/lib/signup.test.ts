import { describe, it, expect } from "vitest";
import { parseSignupInput, parseSignupDecision, normaliseEmail, MIN_PASSWORD, MAX_NAME } from "./signup";

describe("parseSignupInput", () => {
  it("normalise un formulaire valide", () => {
    const r = parseSignupInput({ name: "  Léa   Martin ", email: " Lea.Martin@Example.BE ", password: "motdepasse1" });
    expect(r).toEqual({ ok: true, value: { name: "Léa Martin", email: "lea.martin@example.be", password: "motdepasse1" } });
  });

  it("refuse un nom trop court ou trop long", () => {
    expect(parseSignupInput({ name: "L", email: "a@b.be", password: "motdepasse1" }).ok).toBe(false);
    expect(parseSignupInput({ name: "x".repeat(MAX_NAME + 1), email: "a@b.be", password: "motdepasse1" }).ok).toBe(false);
  });

  it("refuse une adresse invalide", () => {
    for (const email of ["", "pas-un-email", "a@b", "a b@c.be", 42]) {
      const r = parseSignupInput({ name: "Léa", email, password: "motdepasse1" });
      expect(r.ok).toBe(false);
    }
  });

  it("refuse un mot de passe trop court, sans le modifier sinon", () => {
    expect(parseSignupInput({ name: "Léa", email: "a@b.be", password: "x".repeat(MIN_PASSWORD - 1) }).ok).toBe(false);
    const r = parseSignupInput({ name: "Léa", email: "a@b.be", password: "  espaces  " });
    expect(r.ok && r.value.password).toBe("  espaces  ");
  });

  it("refuse un corps qui n'est pas un objet", () => {
    expect(parseSignupInput(null).ok).toBe(false);
    expect(parseSignupInput([]).ok).toBe(false);
    expect(parseSignupInput("x").ok).toBe(false);
  });
});

describe("parseSignupDecision", () => {
  it("accepte approve et reject avec un id uuid", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseSignupDecision({ id, action: "approve" })).toEqual({ ok: true, id, action: "approve" });
    expect(parseSignupDecision({ id, action: "reject" })).toEqual({ ok: true, id, action: "reject" });
  });

  it("refuse une action ou un id inconnus", () => {
    expect(parseSignupDecision({ id: "123e4567-e89b-12d3-a456-426614174000", action: "delete" }).ok).toBe(false);
    expect(parseSignupDecision({ id: "nope", action: "approve" }).ok).toBe(false);
    expect(parseSignupDecision(null).ok).toBe(false);
  });
});

describe("normaliseEmail", () => {
  it("met en minuscules et retire les espaces", () => {
    expect(normaliseEmail("  A@B.Be ")).toBe("a@b.be");
  });
});
