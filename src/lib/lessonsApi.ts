/**
 * Accès client aux leçons stockées dans Supabase via /api/lessons.
 *
 * En base, la colonne jsonb `exercises` contient { blocks: [...] } ; les
 * médias des blocs sont des URLs publiques R2 (voir mediaUpload). Ce module
 * fait la traduction ligne SQL ↔ objet leçon utilisé par les pages.
 */
import type { SavedDeck } from "@/lib/liveDeck";

export interface ApiLesson {
  id: string;
  title: string;
  createdAt: string;
  authorId: string | null;
  blocks: { type: string }[];
  /** Diaporama du cours en direct, tiré de la vidéo d'introduction (voir lib/liveDeck). */
  live: SavedDeck | null;
}

interface LessonRow {
  id: string;
  title: string;
  author_id: string | null;
  exercises: { blocks?: { type: string }[]; live?: SavedDeck } | null;
  created_at: string;
}

function rowToLesson(row: LessonRow): ApiLesson {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    authorId: row.author_id,
    blocks: row.exercises?.blocks ?? [],
    live: row.exercises?.live ?? null,
  };
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  return data as T;
}

/** Liste les leçons (toutes, ou celles d'un auteur). */
export async function fetchLessons(authorId?: string): Promise<ApiLesson[]> {
  const url = authorId ? `/api/lessons?authorId=${encodeURIComponent(authorId)}` : "/api/lessons";
  const rows = await jsonOrThrow<LessonRow[]>(await fetch(url));
  return rows.map(rowToLesson);
}

/** Charge une leçon par id (null si absente). */
export async function fetchLesson(id: string): Promise<ApiLesson | null> {
  const all = await fetchLessons();
  return all.find((l) => l.id === id) ?? null;
}

// L'éditeur ne demande ni matière ni tranche d'âge — la base les exige.
const DEFAULT_SUBJECT = "général";
const DEFAULT_AGE_GROUP = "tous";

/** Crée une leçon ; retourne la ligne créée (avec l'id généré par la base). */
export async function createLesson(title: string, blocks: unknown[]): Promise<ApiLesson> {
  const row = await jsonOrThrow<LessonRow>(await fetch("/api/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject: DEFAULT_SUBJECT, age_group: DEFAULT_AGE_GROUP, exercises: { blocks } }),
  }));
  return rowToLesson(row);
}

/** Met à jour titre et contenu d'une leçon existante. */
export async function updateLesson(id: string, title: string, blocks: unknown[]): Promise<ApiLesson> {
  const row = await jsonOrThrow<LessonRow>(await fetch("/api/lessons", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title, exercises: { blocks } }),
  }));
  return rowToLesson(row);
}

/** Supprime une leçon. */
export async function deleteLesson(id: string): Promise<void> {
  await jsonOrThrow<{ ok: boolean }>(await fetch("/api/lessons", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }));
}
