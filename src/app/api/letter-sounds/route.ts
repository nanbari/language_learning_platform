import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { isQuestionKind } from "@/lib/letterSound";
import { deleteObjects } from "@/server/r2";

/** URL actuellement enregistrée pour une lettre ou une question, s'il y en a une. */
async function previousUrl(table: "letter_sounds" | "question_sounds", column: string, value: unknown): Promise<string | null> {
  const { data } = await supabaseAdmin().from(table).select("url").eq(column, value).maybeSingle();
  return (data as { url?: string } | null)?.url ?? null;
}
import { currentUser, requireAdmin } from "@/server/session";
import { serverError } from "@/server/errors";

const isLetterId = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 28;

// Les sons sont communs à toute la plateforme : seul un admin les modifie.
/**
 * GET /api/letter-sounds
 * Sons enregistrés, pour tout utilisateur connecté.
 * Réponse : { letters: { [numéro de lettre]: URL }, questions: { [type d'exercice]: URL } }
 */
export async function GET(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;

  const [letters, questions] = await Promise.all([
    supabaseAdmin().from("letter_sounds").select("letter_id, url"),
    supabaseAdmin().from("question_sounds").select("kind, url"),
  ]);
  if (letters.error) return serverError("/api/letter-sounds letters.error", letters.error);
  // Questions illisibles (table pas encore créée) : les sons des lettres restent servis.
  return NextResponse.json({
    letters: Object.fromEntries((letters.data ?? []).map((r) => [r.letter_id, r.url])),
    questions: Object.fromEntries((questions.data ?? []).map((r) => [r.kind, r.url])),
  });
}

/**
 * PUT /api/letter-sounds  { letterId, url } ou { question, url }
 * Enregistre (ou remplace) le son d'une lettre ou d'une question d'exercice.
 * Réservé aux admins. L'URL doit être celle d'un fichier déjà téléversé sur
 * notre bucket R2 (voir /api/media).
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: { letterId?: unknown; question?: unknown; url?: unknown } = {};
  try { body = await req.json(); } catch { /* validé ci-dessous */ }
  const { letterId, question, url } = body;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (typeof url !== "string" || !base || !url.startsWith(`${base}/`)) {
    return NextResponse.json({ error: "URL de son invalide" }, { status: 400 });
  }
  const stamp = { url, updated_by: auth.user.id, updated_at: new Date().toISOString() };

  let previous: string | null = null;
  let result;
  if (isLetterId(letterId)) {
    previous = await previousUrl("letter_sounds", "letter_id", letterId);
    result = await supabaseAdmin().from("letter_sounds").upsert({ letter_id: letterId, ...stamp });
  } else if (isQuestionKind(question)) {
    previous = await previousUrl("question_sounds", "kind", question);
    result = await supabaseAdmin().from("question_sounds").upsert({ kind: question, ...stamp });
  } else {
    return NextResponse.json({ error: "Lettre ou question invalide" }, { status: 400 });
  }
  if (result.error) return serverError("/api/letter-sounds result.error", result.error);
  // L'ancien enregistrement, s'il y en avait un autre, ne sert plus à personne : effacé du bucket après coup.
  if (previous && previous !== url) void deleteObjects([previous]);
  return NextResponse.json({ url });
}

/**
 * DELETE /api/letter-sounds?letterId=3 ou ?question=pickSound
 * Supprime un son (admins) : l'exercice revient à la voix de l'appareil
 * pour une lettre, à la question seulement écrite pour une question.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const params = new URL(req.url).searchParams;
  const letterId = Number(params.get("letterId"));
  const question = params.get("question");

  let result;
  if (isLetterId(letterId)) {
    result = await supabaseAdmin().from("letter_sounds").delete().eq("letter_id", letterId).select("url");
  } else if (isQuestionKind(question)) {
    result = await supabaseAdmin().from("question_sounds").delete().eq("kind", question).select("url");
  } else {
    return NextResponse.json({ error: "Lettre ou question invalide" }, { status: 400 });
  }
  if (result.error) return serverError("/api/letter-sounds result.error", result.error);
  void deleteObjects(((result.data ?? []) as { url: string }[]).map((r) => r.url));
  return new NextResponse(null, { status: 204 });
}
