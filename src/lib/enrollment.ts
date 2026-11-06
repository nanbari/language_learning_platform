/**
 * Demandes d'inscription aux cours d'arabe — modèle partagé client / serveur.
 *
 * Un parent remplit le formulaire public (/demande-inscription), partagé avec
 * la vidéo de présentation, pour un ou plusieurs de ses enfants. Rien n'est
 * créé côté élève : chaque enfant devient une ligne de `enrollment_requests`
 * (avec les coordonnées du parent) ; un administrateur recontacte la famille,
 * puis marque chaque demande comme traitée depuis son tableau de bord.
 *
 * Ce module est pur (validation, types) et testé à part ; l'accès base est
 * dans les routes serveur.
 */
import { normaliseEmail } from "@/lib/signup";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";

export const MIN_CHILD_AGE = 4;
export const MAX_CHILD_AGE = 12;
const MAX_NAME = 80;
const MAX_EMAIL = 254;
const MAX_PHONE = 30;
/** Enfants par envoi du formulaire. */
export const MAX_CHILDREN = 6;

export const ENROLLMENT_LEVELS = ["beginner", "reader"] as const;
export type EnrollmentLevel = (typeof ENROLLMENT_LEVELS)[number];

export const LEVEL_LABELS: Record<EnrollmentLevel, { title: string; hint: string }> = {
  beginner: { title: "Débutant", hint: "Ne sait pas encore lire l'arabe, même s'il connaît des lettres" },
  reader: { title: "Lecteur", hint: "Sait lire des mots en arabe, même lentement" },
};

// Précisions sur le niveau (ajoutées en novembre 2026) : lettres déjà
// connues et vocabulaire acquis, pour composer les groupes avant le premier cours.
export const LETTER_KNOWLEDGE = ["none", "some", "all"] as const;
export type LetterKnowledge = (typeof LETTER_KNOWLEDGE)[number];
export const LETTER_KNOWLEDGE_LABELS: Record<LetterKnowledge, string> = {
  none: "Aucune",
  some: "Quelques-unes",
  all: "Toutes les lettres",
};

export const VOCABULARY_LEVELS = ["none", "some", "lots"] as const;
export type VocabularyLevel = (typeof VOCABULARY_LEVELS)[number];
export const VOCABULARY_LABELS: Record<VocabularyLevel, string> = {
  none: "Aucun",
  some: "Un peu",
  lots: "Beaucoup",
};

export const VOCABULARY_DOMAINS = [
  "greetings", "family", "colors", "numbers", "animals", "food", "body", "house", "school", "clothes", "nature",
] as const;
export type VocabularyDomain = (typeof VOCABULARY_DOMAINS)[number];
export const VOCABULARY_DOMAIN_LABELS: Record<VocabularyDomain, string> = {
  greetings: "Salutations et politesse",
  family: "Famille",
  colors: "Couleurs",
  numbers: "Nombres",
  animals: "Animaux",
  food: "Nourriture",
  body: "Corps",
  house: "Maison",
  school: "École",
  clothes: "Vêtements",
  nature: "Nature",
};
/** Autres domaines de vocabulaire, en texte libre. */
export const MAX_VOCABULARY_OTHER = 200;

const LETTER_IDS = new Set(ARABIC_ALPHABET.map((l) => l.id));

type EnrollmentStatus = "new" | "handled";

interface ChildInput {
  name: string;
  age: number;
  level: EnrollmentLevel;
  /** Toujours "all" pour un lecteur (question non posée). */
  letters: LetterKnowledge;
  /** Identifiants (ARABIC_ALPHABET) des lettres connues, quand `letters` vaut "some" ; sinon vide. */
  knownLetters: number[];
  vocabulary: VocabularyLevel;
  /** Domaines connus, quand `vocabulary` n'est pas "none" ; sinon vide. */
  vocabularyDomains: VocabularyDomain[];
  /** Autres domaines, en texte libre ; null si rien. */
  vocabularyOther: string | null;
}

export interface EnrollmentInput {
  parentName: string;
  email: string;
  phone: string;
  children: ChildInput[];
  consent: true;
}

/** Ligne de `enrollment_requests` telle qu'exposée à l'admin. */
export interface EnrollmentRow {
  id: string;
  parent_name: string;
  email: string;
  phone: string;
  child_name: string;
  child_age: number;
  level: EnrollmentLevel;
  /** null : demande antérieure à ces questions (novembre 2026). */
  letters: LetterKnowledge | null;
  known_letters: number[] | null;
  vocabulary: VocabularyLevel | null;
  vocabulary_domains: VocabularyDomain[] | null;
  vocabulary_other: string | null;
  status: EnrollmentStatus;
  created_at: string;
  handled_at: string | null;
}

type ParseResult = { ok: true; value: EnrollmentInput } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Chiffres, espaces, +, points, tirets, parenthèses ; au moins 8 chiffres. */
const PHONE_RE = /^\+?[\d\s.\-()/]+$/;

function cleanText(value: unknown): string | null {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : null;
}

/** Valide et normalise le formulaire d'inscription (un parent, un ou plusieurs enfants). */
export function parseEnrollmentInput(input: unknown): ParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "formulaire invalide" };
  }
  const raw = input as Record<string, unknown>;

  const parentName = cleanText(raw.parentName);
  if (!parentName || parentName.length < 2) return { ok: false, error: "Le nom du parent est requis" };
  if (parentName.length > MAX_NAME) return { ok: false, error: `Le nom du parent doit faire au plus ${MAX_NAME} caractères` };

  if (typeof raw.email !== "string") return { ok: false, error: "L'adresse e-mail est requise" };
  const email = normaliseEmail(raw.email);
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return { ok: false, error: "Adresse e-mail invalide" };

  const phone = cleanText(raw.phone);
  if (!phone) return { ok: false, error: "Le téléphone est requis" };
  if (phone.length > MAX_PHONE || !PHONE_RE.test(phone) || phone.replace(/\D/g, "").length < 8) {
    return { ok: false, error: "Numéro de téléphone invalide" };
  }

  if (!Array.isArray(raw.children) || raw.children.length === 0) return { ok: false, error: "Ajoutez au moins un enfant" };
  if (raw.children.length > MAX_CHILDREN) return { ok: false, error: `${MAX_CHILDREN} enfants au plus par demande` };
  const children: ChildInput[] = [];
  for (const [i, item] of raw.children.entries()) {
    const child = parseChild(item);
    // « Enfant 2 : … » quand il y en a plusieurs, pour savoir lequel corriger.
    if (!child.ok) return { ok: false, error: raw.children.length > 1 ? `Enfant ${i + 1} : ${child.error}` : child.error };
    children.push(child.value);
  }

  if (raw.consent !== true) return { ok: false, error: "Votre accord est nécessaire pour envoyer la demande" };

  return { ok: true, value: { parentName, email, phone, children, consent: true } };
}

function parseChild(input: unknown): { ok: true; value: ChildInput } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "enfant invalide" };
  const raw = input as Record<string, unknown>;

  const name = cleanText(raw.name);
  if (!name) return { ok: false, error: "le prénom est requis" };
  if (name.length > MAX_NAME) return { ok: false, error: `le prénom doit faire au plus ${MAX_NAME} caractères` };

  const age = typeof raw.age === "string" ? Number(raw.age) : raw.age;
  if (typeof age !== "number" || !Number.isInteger(age) || age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) {
    return { ok: false, error: `l'âge doit être entre ${MIN_CHILD_AGE} et ${MAX_CHILD_AGE} ans` };
  }

  if (!ENROLLMENT_LEVELS.includes(raw.level as EnrollmentLevel)) return { ok: false, error: "choisissez le niveau" };

  const level = raw.level as EnrollmentLevel;
  // Un lecteur connaît forcément les lettres : la question ne lui est pas posée.
  if (level === "reader") raw.letters = "all";
  if (!LETTER_KNOWLEDGE.includes(raw.letters as LetterKnowledge)) return { ok: false, error: "indiquez s'il connaît des lettres" };
  const letters = raw.letters as LetterKnowledge;
  let knownLetters: number[] = [];
  if (letters === "some") {
    if (!Array.isArray(raw.knownLetters)) return { ok: false, error: "cochez les lettres qu'il connaît" };
    if (!raw.knownLetters.every((id) => typeof id === "number" && LETTER_IDS.has(id))) return { ok: false, error: "lettre inconnue" };
    knownLetters = [...new Set(raw.knownLetters as number[])].sort((a, b) => a - b);
    if (knownLetters.length === 0) return { ok: false, error: "cochez les lettres qu'il connaît" };
  }

  if (!VOCABULARY_LEVELS.includes(raw.vocabulary as VocabularyLevel)) return { ok: false, error: "indiquez s'il a du vocabulaire" };
  const vocabulary = raw.vocabulary as VocabularyLevel;
  let vocabularyDomains: VocabularyDomain[] = [];
  let vocabularyOther: string | null = null;
  if (vocabulary !== "none") {
    if (!Array.isArray(raw.vocabularyDomains)) return { ok: false, error: "indiquez les domaines de vocabulaire" };
    if (!raw.vocabularyDomains.every((d) => VOCABULARY_DOMAINS.includes(d as VocabularyDomain))) return { ok: false, error: "domaine inconnu" };
    vocabularyDomains = VOCABULARY_DOMAINS.filter((d) => (raw.vocabularyDomains as string[]).includes(d));
    const other = raw.vocabularyOther == null ? "" : cleanText(raw.vocabularyOther);
    if (other === null) return { ok: false, error: "autres domaines invalides" };
    if (other.length > MAX_VOCABULARY_OTHER) return { ok: false, error: `les autres domaines doivent faire au plus ${MAX_VOCABULARY_OTHER} caractères` };
    vocabularyOther = other || null;
    if (vocabularyDomains.length === 0 && !vocabularyOther) return { ok: false, error: "indiquez les domaines de vocabulaire" };
  }

  return { ok: true, value: { name, age, level, letters, knownLetters, vocabulary, vocabularyDomains, vocabularyOther } };
}

/** Valide le corps « marquer comme traitée » envoyé par l'admin. */
export function parseEnrollmentHandled(input: unknown): { ok: true; id: string } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "corps invalide" };
  const { id } = input as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "id invalide" };
  return { ok: true, id };
}
