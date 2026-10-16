import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { isQuestionKind } from "@/lib/letterSound";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

const isLetterId = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 28;

// Les sons sont communs à toute la plateforme : seul un admin les modifie.
async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!session.isAdmin) return { error: NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 }) };
  return { session };
}

/**
 * GET /api/letter-sounds
 * Sons enregistrés, pour tout utilisateur connecté.
 * Réponse : { letters: { [numéro de lettre]: URL }, questions: { [type d'exercice]: URL } }
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [letters, questions] = await Promise.all([
    supabase().from("letter_sounds").select("letter_id, url"),
    supabase().from("question_sounds").select("kind, url"),
  ]);
  if (letters.error) return NextResponse.json({ error: letters.error.message }, { status: 500 });
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
  const stamp = { url, updated_by: auth.session.id, updated_at: new Date().toISOString() };

  let result;
  if (isLetterId(letterId)) {
    result = await supabase().from("letter_sounds").upsert({ letter_id: letterId, ...stamp });
  } else if (isQuestionKind(question)) {
    result = await supabase().from("question_sounds").upsert({ kind: question, ...stamp });
  } else {
    return NextResponse.json({ error: "Lettre ou question invalide" }, { status: 400 });
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
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
    result = await supabase().from("letter_sounds").delete().eq("letter_id", letterId);
  } else if (isQuestionKind(question)) {
    result = await supabase().from("question_sounds").delete().eq("kind", question);
  } else {
    return NextResponse.json({ error: "Lettre ou question invalide" }, { status: 400 });
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
