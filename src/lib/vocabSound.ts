import { playSound, stopSound } from "@/lib/soundPlayer";

/**
 * Enregistrements du vocabulaire (page « Enregistrements audio ») : pour
 * chaque mot, la question lue par l'enseignant ; sous `INSTRUCTION_ID`, la
 * consigne de l'exercice (« Écoute, puis choisis l'image. »). Les fichiers
 * sont sur R2, leurs adresses dans la table vocab_sounds, servies par
 * /api/vocab-sounds : les élèves les entendent sur n'importe quel appareil.
 */

export const INSTRUCTION_ID = "_instruction";

/** { [id du mot]: URL } */
export type VocabSounds = Record<string, string>;

let cached: Promise<VocabSounds> | null = null;

/** Charge une fois les sons enregistrés ; une erreur vaut « aucun son ». */
export function loadVocabSounds(): Promise<VocabSounds> {
  cached ??= fetch("/api/vocab-sounds")
    .then((r) => (r.ok ? r.json() : {}))
    .then((s: VocabSounds | null) => s ?? {})
    .catch(() => ({}));
  return cached;
}

/** À appeler après un enregistrement ou une suppression. */
function forgetVocabSounds() {
  cached = null;
}

export async function saveVocabSound(wordId: string, url: string): Promise<void> {
  const res = await fetch("/api/vocab-sounds", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  forgetVocabSounds();
}

export async function deleteVocabSound(wordId: string): Promise<void> {
  const res = await fetch(`/api/vocab-sounds?wordId=${encodeURIComponent(wordId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  forgetVocabSounds();
}

/**
 * Joue le son d'un mot (ou la consigne). Renvoie false s'il n'existe pas ou
 * n'a pas pu démarrer. Un seul son à la fois : en lancer un coupe le précédent.
 */
export async function playVocabSound(wordId: string): Promise<boolean> {
  stopSound();
  const sounds = await loadVocabSounds();
  const url = sounds[wordId];
  if (!url) return false;
  return playSound(url);
}
