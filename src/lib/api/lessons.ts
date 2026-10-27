/**
 * Accès client aux leçons stockées dans Supabase via /api/lessons.
 *
 * En base, la colonne jsonb `exercises` contient { blocks: [...] } ; les
 * médias des blocs sont des URLs publiques R2 (voir mediaUpload). Ce module
 * fait la traduction ligne SQL ↔ objet leçon utilisé par les pages.
 */
import type { SavedDeck } from "@/lib/liveDeck";
import { jsonOrThrow } from "@/lib/api/client";

export interface ApiLesson {
  id: string;
  title: string;
  createdAt: string;
  authorId: string | null;
  /** Classe à qui la leçon est proposée ; null = visible d'aucun élève. */
  classId: string | null;
  blocks: { type: string }[];
  /** Diaporama du cours en direct, enregistré depuis l'éditeur (voir lib/lessonDeck). */
  live: SavedDeck | null;
  /** Le diaporama ne correspond plus au contenu de la leçon (calculé par le serveur) ; null sans diaporama. */
  liveStale: boolean | null;
  /** Numéro de version (migration 2026-10-29) : renvoyé à l'enregistrement pour détecter un conflit ; absent avant la migration. */
  version: number | null;
}

interface LessonRow {
  id: string;
  title: string;
  author_id: string | null;
  class_id: string | null;
  exercises: { blocks?: { type: string }[]; live?: SavedDeck } | null;
  created_at: string;
  live_stale?: boolean | null;
  version?: number | null;
}

function rowToLesson(row: LessonRow): ApiLesson {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    authorId: row.author_id,
    classId: row.class_id,
    blocks: row.exercises?.blocks ?? [],
    live: row.exercises?.live ?? null,
    liveStale: row.live_stale ?? null,
    version: typeof row.version === "number" ? row.version : null,
  };
}

/** Liste les leçons (toutes, ou celles d'un auteur). */
export async function fetchLessons(authorId?: string): Promise<ApiLesson[]> {
  const url = authorId ? `/api/lessons?authorId=${encodeURIComponent(authorId)}` : "/api/lessons";
  const rows = await jsonOrThrow<LessonRow[]>(await fetch(url));
  return rows.map(rowToLesson);
}

/** Charge une leçon par id (null si absente). */
export async function fetchLesson(id: string): Promise<ApiLesson | null> {
  const res = await fetch(`/api/lessons/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  return rowToLesson(await jsonOrThrow<LessonRow>(res));
}

// L'éditeur ne demande ni matière ni tranche d'âge — la base les exige.
const DEFAULT_SUBJECT = "général";
const DEFAULT_AGE_GROUP = "tous";

/** Crée une leçon ; retourne la ligne créée (avec l'id généré par la base). */
export async function createLesson(title: string, classId: string, blocks: unknown[]): Promise<ApiLesson> {
  const row = await jsonOrThrow<LessonRow>(await fetch("/api/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject: DEFAULT_SUBJECT, age_group: DEFAULT_AGE_GROUP, class_id: classId, exercises: { blocks } }),
  }));
  return rowToLesson(row);
}

/** Met à jour titre, classe et contenu d'une leçon existante. */
/**
 * Enregistre une leçon. Avec `version`, le serveur refuse (409) si la leçon a
 * été modifiée depuis son ouverture ; sans, il écrase.
 */
export async function updateLesson(id: string, title: string, classId: string, blocks: unknown[], version?: number | null): Promise<ApiLesson> {
  const row = await jsonOrThrow<LessonRow>(await fetch("/api/lessons", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title, class_id: classId, exercises: { blocks }, ...(typeof version === "number" && { version }) }),
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
