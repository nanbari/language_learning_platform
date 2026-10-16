/**
 * Diaporama du cours en direct d'une leçon. Depuis l'éditeur, l'enseignant
 * le demande : il est construit à partir des blocs de la leçon (src/lib/liveDeck),
 * puis enregistré avec la leçon, prêt à être lancé en direct.
 *
 * Le diaporama est identifié par l'empreinte de son contenu : le redemander
 * pour une leçon inchangée ne refait rien (les exercices ne sont pas tirés
 * au sort à nouveau) ; si la leçon a changé, le nouveau remplace l'ancien.
 */
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { charterColor } from "@/lib/presentation";
import { buildLessonDeck, lessonParts, type SavedDeck } from "@/lib/liveDeck";

type Block = { id?: string; type?: string; recap?: boolean };
type Exercises = { blocks?: Block[]; live?: SavedDeck };

/** À augmenter quand la construction du diaporama change : les diaporamas déjà enregistrés seront refaits. */
const DECK_VERSION = 12;

function fingerprint(content: unknown): string {
  return createHash("sha1").update(DECK_VERSION + JSON.stringify(content)).digest("hex").slice(0, 16);
}

/**
 * Construit et enregistre le diaporama d'une leçon. Renvoie le diaporama, et
 * `changed: false` si la leçon avait déjà celui-ci. Lève une erreur si la
 * leçon n'a ni bloc « Lettres » complet, ni assez de vocabulaire.
 */
export async function saveLessonDeck(lessonId: string): Promise<{ deck: SavedDeck; changed: boolean }> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("lessons").select("id, title, exercises").eq("id", lessonId).single();
  if (error || !data) throw new Error(`Leçon ${lessonId} introuvable`);
  // Même couleur qu'en séance jusqu'ici : celle du rang de la leçon dans la liste.
  const { data: ids } = await db.from("lessons").select("id").order("created_at", { ascending: false });
  const rank = Math.max(0, (ids ?? []).findIndex((l) => l.id === data.id));
  const exercises = (data.exercises ?? {}) as Exercises;
  const color = charterColor(rank);

  const parts = lessonParts(data.title, exercises.blocks ?? [], color);
  if (parts.length === 0) throw new Error("La leçon n'a ni lettres ni assez de vocabulaire pour un diaporama");
  const key = fingerprint(parts);
  if (exercises.live?.key === key) return { deck: exercises.live, changed: false };

  const slides = buildLessonDeck(parts);
  const deck: SavedDeck = { key, slides, createdAt: new Date().toISOString() };
  // Les anciennes vidéos d'introduction placées en tête de la leçon sont retirées.
  const blocks = (exercises.blocks ?? []).filter((b) => !b.recap);
  const { error: saveError } = await db.from("lessons").update({ exercises: { ...exercises, blocks, live: deck } }).eq("id", lessonId);
  if (saveError) throw new Error(saveError.message);
  return { deck, changed: true };
}
