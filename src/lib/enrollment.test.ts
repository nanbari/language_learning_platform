import { describe, expect, it } from "vitest";
import { MAX_CHILDREN, parseEnrollmentHandled, parseEnrollmentInput } from "./enrollment";

const ADAM = { name: " Adam ", age: 7, level: "beginner" };
const VALID = {
  parentName: "  Léa   Martin ",
  email: " Lea.Martin@Example.BE ",
  phone: "+32 470 12 34 56",
  children: [ADAM],
  consent: true,
};

describe("parseEnrollmentInput", () => {
  it("nettoie les champs", () => {
    expect(parseEnrollmentInput(VALID)).toEqual({
      ok: true,
      value: {
        parentName: "Léa Martin",
        email: "lea.martin@example.be",
        phone: "+32 470 12 34 56",
        children: [{ name: "Adam", age: 7, level: "beginner" }],
        consent: true,
      },
    });
  });

  it("accepte plusieurs enfants, l'âge en texte venant de la liste déroulante", () => {
    const r = parseEnrollmentInput({ ...VALID, children: [ADAM, { name: "Inès", age: "12", level: "reader" }] });
    expect(r.ok && r.value.children).toEqual([
      { name: "Adam", age: 7, level: "beginner" },
      { name: "Inès", age: 12, level: "reader" },
    ]);
  });

  it("exige entre un et MAX_CHILDREN enfants", () => {
    expect(parseEnrollmentInput({ ...VALID, children: [] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: Array(MAX_CHILDREN + 1).fill(ADAM) }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: ADAM }).ok).toBe(false);
  });

  it("refuse un âge hors de 4 à 12 ans", () => {
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, age: 3 }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, age: 13 }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, age: 6.5 }] }).ok).toBe(false);
  });

  it("indique quel enfant corriger quand il y en a plusieurs", () => {
    expect(parseEnrollmentInput({ ...VALID, children: [ADAM, { ...ADAM, name: "  " }] }))
      .toEqual({ ok: false, error: "Enfant 2 : le prénom est requis" });
  });

  it("refuse un e-mail ou un téléphone invalides", () => {
    expect(parseEnrollmentInput({ ...VALID, email: "pas-un-email" }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, phone: "12 34" }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, phone: "appelez-moi" }).ok).toBe(false);
  });

  it("exige un niveau et l'accord", () => {
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, level: "expert" }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, consent: false }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, consent: "true" }).ok).toBe(false);
  });

  it("refuse un corps qui n'est pas un objet", () => {
    expect(parseEnrollmentInput(null).ok).toBe(false);
    expect(parseEnrollmentInput([VALID]).ok).toBe(false);
  });
});

describe("parseEnrollmentHandled", () => {
  it("n'accepte qu'un identifiant uuid", () => {
    expect(parseEnrollmentHandled({ id: "11111111-1111-4111-8111-111111111111" }).ok).toBe(true);
    expect(parseEnrollmentHandled({ id: "1" }).ok).toBe(false);
    expect(parseEnrollmentHandled(null).ok).toBe(false);
  });
});
