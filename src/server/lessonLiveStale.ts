import { isDeckStale } from "@/server/lessonDeck";
import type { SavedDeck } from "@/lib/liveDeck";
import { supabaseAdmin } from "@/server/supabase";

interface LessonRowLike {
  id: string;
  title: string;
  exercises: unknown;
}

/**
 * Ajoute `live_stale` à des lignes de leçons : le diaporama du cours en
 * direct est-il à refaire ? Calculé ici, avec la même empreinte que
 * lib/lessonDeck (la couleur dépend du rang de la leçon dans la liste
 * complète, d'où la lecture des ids). `null` sans diaporama ou en cas de
 * doute : jamais une erreur pour l'appelant.
 */
export async function withLiveStale<T extends LessonRowLike>(rows: T[]): Promise<(T & { live_stale: boolean | null })[]> {
  const { data: ids } = await supabaseAdmin().from("lessons").select("id").order("created_at", { ascending: false });
  const rankOf = new Map((ids ?? []).map((l: { id: string }, i: number) => [l.id, i]));
  return rows.map((row) => {
    const exercises = (row.exercises ?? {}) as { blocks?: { id?: string; type?: string; recap?: boolean }[]; live?: SavedDeck };
    let live_stale: boolean | null = null;
    try { live_stale = isDeckStale(row.title, exercises.blocks ?? [], rankOf.get(row.id) ?? 0, exercises.live); } catch { live_stale = null; }
    return { ...row, live_stale };
  });
}
