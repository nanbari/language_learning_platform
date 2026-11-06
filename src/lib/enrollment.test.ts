import { describe, expect, it } from "vitest";
import { MAX_CHILDREN, parseEnrollmentHandled, parseEnrollmentInput } from "@/lib/enrollment";

const ADAM = { name: " Adam ", age: 7, level: "beginner", letters: "none", vocabulary: "none" };
const NOTHING = { letters: "none", knownLetters: [], vocabulary: "none", vocabularyDomains: [], vocabularyOther: null };
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
        children: [{ name: "Adam", age: 7, level: "beginner", ...NOTHING }],
        consent: true,
      },
    });
  });

  it("accepte plusieurs enfants, l'âge en texte venant de la liste déroulante", () => {
    const r = parseEnrollmentInput({ ...VALID, children: [ADAM, { ...ADAM, name: "Inès", age: "12", level: "reader" }] });
    expect(r.ok && r.value.children).toEqual([
      { name: "Adam", age: 7, level: "beginner", ...NOTHING },
      { name: "Inès", age: 12, level: "reader", ...NOTHING, letters: "all" },
    ]);
  });

  it("garde les lettres connues (dédoublonnées, dans l'ordre de l'alphabet) seulement pour « quelques-unes »", () => {
    const some = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, letters: "some", knownLetters: [3, 1, 3] }] });
    expect(some.ok && some.value.children[0]).toMatchObject({ letters: "some", knownLetters: [1, 3] });
    const all = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, letters: "all", knownLetters: [1, 2] }] });
    expect(all.ok && all.value.children[0]).toMatchObject({ letters: "all", knownLetters: [] });
  });

  it("un lecteur connaît toutes les lettres : la réponse envoyée est ignorée", () => {
    const r = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, level: "reader", letters: undefined, knownLetters: [1] }] });
    expect(r.ok && r.value.children[0]).toMatchObject({ level: "reader", letters: "all", knownLetters: [] });
    const some = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, level: "reader", letters: "some", knownLetters: [1] }] });
    expect(some.ok && some.value.children[0]).toMatchObject({ letters: "all", knownLetters: [] });
  });

  it("refuse « quelques lettres » sans lettre cochée, une lettre inconnue ou une réponse manquante", () => {
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, letters: "some", knownLetters: [] }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, letters: "some", knownLetters: [99] }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, letters: "some", knownLetters: ["1"] }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, letters: undefined }] }).ok).toBe(false);
  });

  it("garde les domaines de vocabulaire et le texte libre seulement pour « un peu » de vocabulaire", () => {
    const some = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "some", vocabularyDomains: ["food", "family", "food"], vocabularyOther: "  les  jours " }] });
    expect(some.ok && some.value.children[0]).toMatchObject({ vocabulary: "some", vocabularyDomains: ["family", "food"], vocabularyOther: "les jours" });
    const otherOnly = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "some", vocabularyDomains: [], vocabularyOther: "les fruits" }] });
    expect(otherOnly.ok && otherOnly.value.children[0]).toMatchObject({ vocabulary: "some", vocabularyDomains: [], vocabularyOther: "les fruits" });
    // « Beaucoup » : la question des domaines n'est pas posée, rien n'est gardé.
    const lots = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "lots", vocabularyDomains: ["food"], vocabularyOther: "x" }] });
    expect(lots.ok && lots.value.children[0]).toMatchObject({ vocabulary: "lots", vocabularyDomains: [], vocabularyOther: null });
    const none = parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "none", vocabularyDomains: ["food"], vocabularyOther: "x" }] });
    expect(none.ok && none.value.children[0]).toMatchObject({ vocabulary: "none", vocabularyDomains: [], vocabularyOther: null });
  });

  it("refuse du vocabulaire sans domaine ni texte, un domaine inconnu ou un texte trop long", () => {
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "some", vocabularyDomains: [], vocabularyOther: "  " }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "some", vocabularyDomains: ["magie"] }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "some", vocabularyDomains: ["food"], vocabularyOther: "x".repeat(201) }] }).ok).toBe(false);
    expect(parseEnrollmentInput({ ...VALID, children: [{ ...ADAM, vocabulary: "énorme" }] }).ok).toBe(false);
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
