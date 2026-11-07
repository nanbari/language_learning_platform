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

/**
 * Cycle de vie d'une demande (décisions de l'admin, voir EnrollmentAction) :
 *  - "new"      : à traiter ;
 *  - "enrolled" : enfant inscrit, la demande (coordonnées du parent) est
 *                 conservée tant que l'inscription dure ; `ended_at` marque la fin ;
 *  - "closed"   : famille recontactée, pas d'inscription.
 * Conservation (mention RGPD du formulaire) : une demande sans suite est
 * effacée RETENTION_CLOSED_MONTHS après son classement, une inscription
 * terminée RETENTION_ENDED_MONTHS après sa fin — par la tâche planifiée de
 * la base (migration 2026-11-07_enrollment_requests_retention).
 */
export type EnrollmentStatus = "new" | "enrolled" | "closed";
export const RETENTION_CLOSED_MONTHS = 6;
export const RETENTION_ENDED_MONTHS = 12;

export const ENROLLMENT_ACTIONS = ["enroll", "close", "end"] as const;
/** "enroll" : inscrit ; "close" : sans suite ; "end" : fin d'inscription d'un enfant inscrit. */
export type EnrollmentAction = (typeof ENROLLMENT_ACTIONS)[number];

interface ChildInput {
  name: string;
  age: number;
  level: EnrollmentLevel;
  /** Toujours "all" pour un lecteur (question non posée). */
  letters: LetterKnowledge;
  /** Identifiants (ARABIC_ALPHABET) des lettres connues, quand `letters` vaut "some" ; sinon vide. */
  knownLetters: number[];
  /**
   * Lettres reconnues dans leurs formes attachées (début, milieu, fin) : demandé
   * seulement au débutant qui connaît toutes les lettres isolées ; null sinon
   * (un lecteur les connaît, la question ne lui est pas posée).
   */
  letterForms: LetterKnowledge | null;
  /** Identifiants des lettres dont il reconnaît les formes attachées, quand `letterForms` vaut "some" ; sinon vide. */
  knownLetterForms: number[];
  vocabulary: VocabularyLevel;
  /** Domaines connus, quand `vocabulary` vaut "some" (question non posée pour "none" et "lots") ; sinon vide. */
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
  letter_forms: LetterKnowledge | null;
  known_letter_forms: number[] | null;
  vocabulary: VocabularyLevel | null;
  vocabulary_domains: VocabularyDomain[] | null;
  vocabulary_other: string | null;
  status: EnrollmentStatus;
  created_at: string;
  /** Date de la décision (inscrit ou sans suite). */
  handled_at: string | null;
  /** Fin de l'inscription d'un enfant inscrit ; null tant qu'il suit les cours. */
  ended_at: string | null;
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
  const known = parseKnownLetters(raw.knownLetters, letters);
  if (!known.ok) return known;
  const knownLetters = known.value;

  // Formes attachées : seulement pour un débutant qui connaît toutes les lettres isolées.
  let letterForms: LetterKnowledge | null = null;
  let knownLetterForms: number[] = [];
  if (level === "beginner" && letters === "all") {
    if (!LETTER_KNOWLEDGE.includes(raw.letterForms as LetterKnowledge)) {
      return { ok: false, error: "indiquez s'il connaît des lettres attachées (début, milieu, fin)" };
    }
    letterForms = raw.letterForms as LetterKnowledge;
    const forms = parseKnownLetters(raw.knownLetterForms, letterForms);
    if (!forms.ok) return forms;
    knownLetterForms = forms.value;
  }

  if (!VOCABULARY_LEVELS.includes(raw.vocabulary as VocabularyLevel)) return { ok: false, error: "indiquez s'il a du vocabulaire" };
  const vocabulary = raw.vocabulary as VocabularyLevel;
  let vocabularyDomains: VocabularyDomain[] = [];
  let vocabularyOther: string | null = null;
  // Les domaines ne sont demandés qu'avec « un peu » de vocabulaire.
  if (vocabulary === "some") {
    if (!Array.isArray(raw.vocabularyDomains)) return { ok: false, error: "indiquez les domaines de vocabulaire" };
    if (!raw.vocabularyDomains.every((d) => VOCABULARY_DOMAINS.includes(d as VocabularyDomain))) return { ok: false, error: "domaine inconnu" };
    vocabularyDomains = VOCABULARY_DOMAINS.filter((d) => (raw.vocabularyDomains as string[]).includes(d));
    const other = raw.vocabularyOther == null ? "" : cleanText(raw.vocabularyOther);
    if (other === null) return { ok: false, error: "autres domaines invalides" };
    if (other.length > MAX_VOCABULARY_OTHER) return { ok: false, error: `les autres domaines doivent faire au plus ${MAX_VOCABULARY_OTHER} caractères` };
    vocabularyOther = other || null;
    if (vocabularyDomains.length === 0 && !vocabularyOther) return { ok: false, error: "indiquez les domaines de vocabulaire" };
  }

  return { ok: true, value: { name, age, level, letters, knownLetters, letterForms, knownLetterForms, vocabulary, vocabularyDomains, vocabularyOther } };
}

/** Lettres cochées (dédoublonnées, dans l'ordre de l'alphabet) ; requises et non vides seulement pour « quelques-unes ». */
function parseKnownLetters(raw: unknown, knowledge: LetterKnowledge): { ok: true; value: number[] } | { ok: false; error: string } {
  if (knowledge !== "some") return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "cochez les lettres qu'il connaît" };
  if (!raw.every((id) => typeof id === "number" && LETTER_IDS.has(id))) return { ok: false, error: "lettre inconnue" };
  const ids = [...new Set(raw as number[])].sort((a, b) => a - b);
  if (ids.length === 0) return { ok: false, error: "cochez les lettres qu'il connaît" };
  return { ok: true, value: ids };
}

/** Valide la décision envoyée par l'admin : { id, action }. */
export function parseEnrollmentAction(input: unknown): { ok: true; id: string; action: EnrollmentAction } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "corps invalide" };
  const { id, action } = input as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "id invalide" };
  if (!ENROLLMENT_ACTIONS.includes(action as EnrollmentAction)) return { ok: false, error: "action invalide" };
  return { ok: true, id, action: action as EnrollmentAction };
}
