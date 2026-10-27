import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { VOCAB_THEMES } from "@/data/arabicVocabulary";
import { INSTRUCTION_ID } from "@/lib/vocabSound";
import { deleteObjects } from "@/server/r2";
import { currentUser, requireStaff } from "@/server/session";
import { serverError } from "@/server/errors";

const KNOWN_IDS = new Set<string>([INSTRUCTION_ID, ...VOCAB_THEMES.flatMap((t) => t.words.map((w) => w.id))]);
const isWordId = (v: unknown): v is string => typeof v === "string" && KNOWN_IDS.has(v);

// Le vocabulaire est commun à toute la plateforme : les enseignants (et admins) l'enregistrent.
/**
 * GET /api/vocab-sounds
 * Enregistrements du vocabulaire, pour tout utilisateur connecté.
 * Réponse : { [id du mot]: URL } ; « _instruction » = la consigne de l'exercice.
 * Table absente (migration pas encore passée) : réponse vide, l'exercice reste muet.
 */
export async function GET(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const { data, error } = await supabaseAdmin().from("vocab_sounds").select("word_id, url");
  if (error) return NextResponse.json({});
  return NextResponse.json(Object.fromEntries((data ?? []).map((r) => [r.word_id, r.url])));
}

/**
 * PUT /api/vocab-sounds  { wordId, url }
 * Enregistre (ou remplace) le son d'un mot. L'URL doit être celle d'un
 * fichier déjà téléversé sur notre bucket R2 (voir /api/media).
 */
export async function PUT(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  let body: { wordId?: unknown; url?: unknown } = {};
  try { body = await req.json(); } catch { /* validé ci-dessous */ }
  const { wordId, url } = body;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (typeof url !== "string" || !base || !url.startsWith(`${base}/`)) {
    return NextResponse.json({ error: "URL de son invalide" }, { status: 400 });
  }
  if (!isWordId(wordId)) return NextResponse.json({ error: "Mot inconnu" }, { status: 400 });
  // L'ancien enregistrement du mot, s'il y en avait un autre, est effacé du bucket après coup.
  const { data: previous } = await supabaseAdmin().from("vocab_sounds").select("url").eq("word_id", wordId).maybeSingle();
  const { error } = await supabaseAdmin().from("vocab_sounds").upsert({
    word_id: wordId, url, updated_by: auth.user.id, updated_at: new Date().toISOString(),
  });
  if (error) return serverError("/api/vocab-sounds error", error);
  if (previous?.url && previous.url !== url) void deleteObjects([previous.url as string]);
  return NextResponse.json({ url });
}

/** DELETE /api/vocab-sounds?wordId=a3 — retire le son d'un mot ; l'exercice redevient muet pour lui. */
export async function DELETE(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  const wordId = new URL(req.url).searchParams.get("wordId");
  if (!isWordId(wordId)) return NextResponse.json({ error: "Mot inconnu" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("vocab_sounds").delete().eq("word_id", wordId).select("url");
  if (error) return serverError("/api/vocab-sounds error", error);
  void deleteObjects(((data ?? []) as { url: string }[]).map((r) => r.url));
  return NextResponse.json({ ok: true });
}
