import type { ArabicLetter } from "@/data/arabicAlphabet";

/**
 * Sons enregistrés par un admin sur la plateforme (page « Sons des lettres ») :
 *
 * - Son d'une lettre, joué dans « choisir le son », par ordre de préférence :
 *   1. l'enregistrement fait sur la plateforme,
 *   2. le fichier du projet `public/sounds/letters/<numéro>.mp3`,
 *   3. la voix arabe de l'appareil.
 * - Question d'un exercice de lettres, lue à voix haute à l'élève quand
 *   l'exercice apparaît dans une leçon. Sans enregistrement, elle reste écrite.
 */

/**
 * Exercices de lettres dont la question peut être enregistrée. « Retrouver la
 * lettre » n'en a pas : l'élève entend le son de la lettre à trouver.
 */
export const QUESTION_KINDS = ["pickSound", "findInWord", "completeWord"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export function isQuestionKind(kind: unknown): kind is QuestionKind {
  return QUESTION_KINDS.includes(kind as QuestionKind);
}

/**
 * La question enregistrée est-elle lue en arrivant sur cet exercice ? Des
 * exercices de même type à la suite (les trois mots à compléter du niveau
 * avancé) posent la même question : elle n'est lue qu'au premier. Elle reste
 * écrite au-dessus de chacun, et réécoutable avec le bouton.
 */
export function readsQuestionOnArrival(kind: unknown, previousKind: unknown): kind is QuestionKind {
  return isQuestionKind(kind) && kind !== previousKind;
}

export function letterSoundUrl(letter: ArabicLetter): string {
  return `/sounds/letters/${letter.id}.mp3`;
}

/** Sons enregistrés sur la plateforme. */
export interface Sounds {
  letters: Record<number, string>;
  questions: Partial<Record<QuestionKind, string>>;
}

let recorded: Promise<Sounds> | null = null;

/** Charge une fois les sons enregistrés ; une erreur vaut « aucun son ». */
export function loadSounds(): Promise<Sounds> {
  recorded ??= fetch("/api/letter-sounds")
    .then((r) => (r.ok ? r.json() : null))
    .then((s: Partial<Sounds> | null) => ({ letters: s?.letters ?? {}, questions: s?.questions ?? {} }))
    .catch(() => ({ letters: {}, questions: {} }));
  return recorded;
}

/** À appeler après un enregistrement ou une suppression. */
export function forgetSounds() {
  recorded = null;
}

type SoundTarget = { letterId: number } | { question: QuestionKind };

export async function saveSound(target: SoundTarget, url: string): Promise<void> {
  const res = await fetch("/api/letter-sounds", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  forgetSounds();
}

export async function deleteSound(target: SoundTarget): Promise<void> {
  const query = "letterId" in target ? `letterId=${target.letterId}` : `question=${target.question}`;
  const res = await fetch(`/api/letter-sounds?${query}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  forgetSounds();
}

/** Ce que la voix de synthèse prononce : la lettre portant une fatha (« بَ »). */
export function spokenSound(letter: ArabicLetter): string {
  return `${letter.id === 1 ? "أ" : letter.isolated}َ`;
}

let current: HTMLAudioElement | null = null;

function speak(letter: ArabicLetter) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenSound(letter));
  utterance.lang = "ar-SA";
  utterance.rate = 0.8;
  const voice = synth.getVoices().find((v) => v.lang.startsWith("ar"));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

/** Joue la première source lisible, sinon `fallback`. */
function playFirst(urls: string[], fallback: () => void) {
  const [url, ...rest] = urls;
  if (!url) { fallback(); return; }
  const audio = new Audio(url);
  current = audio;
  // Fichier absent ou illisible : la source suivante prend le relais.
  audio.play().catch(() => { if (current === audio) playFirst(rest, fallback); });
}

/**
 * Un seul son à la fois : en lancer un coupe le précédent, y compris celui
 * qui attend encore le chargement des sons enregistrés.
 */
function play(pick: (sounds: Sounds) => string[], fallback: () => void) {
  current?.pause();
  window.speechSynthesis?.cancel();
  const marker = new Audio();
  current = marker;
  loadSounds().then((sounds) => {
    if (current === marker) playFirst(pick(sounds), fallback);
  });
}

export function playLetterSound(letter: ArabicLetter) {
  play((s) => [s.letters[letter.id], letterSoundUrl(letter)].filter((u): u is string => !!u), () => speak(letter));
}

/** Lit la question enregistrée d'un exercice ; rien s'il n'y en a pas. */
export function playQuestionSound(kind: QuestionKind) {
  play((s) => [s.questions[kind]].filter((u): u is string => !!u), () => {});
}

/** Coupe le son en cours (changement d'exercice). */
export function stopSounds() {
  current?.pause();
  current = null;
  window.speechSynthesis?.cancel();
}
