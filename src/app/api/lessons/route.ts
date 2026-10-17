import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession, isStaff, type SessionUser } from "@/lib/auth";
import { ownedClass, studentClassIds } from "@/app/api/classes/access";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
// Initialisation paresseuse : la clé service-role n'est disponible qu'à
// l'exécution, pas au build (où Next évalue les modules des routes).
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(COOKIE_NAME)?.value);
}

/**
 * Valide la classe à laquelle la leçon est proposée : l'enseignant doit la
 * gérer (n'importe laquelle pour un admin). Renvoie la réponse d'erreur sinon.
 */
async function checkClass(session: SessionUser, classId: unknown) {
  if (typeof classId !== "string") {
    return NextResponse.json({ error: "Choisissez la classe à qui proposer la leçon" }, { status: 400 });
  }
  const owned = await ownedClass(session, classId);
  return "error" in owned ? owned.error : null;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const authorId = searchParams.get("authorId");

  let query = supabase().from("lessons").select("*").order("created_at", { ascending: false });
  // Un élève ne voit que les leçons proposées à ses classes.
  if (!isStaff(session)) {
    const classIds = await studentClassIds(session.id).catch(() => null);
    if (!classIds) return NextResponse.json({ error: "Erreur de lecture des classes" }, { status: 500 });
    if (classIds.length === 0) return NextResponse.json([]);
    query = query.in("class_id", classIds);
  } else if (authorId) {
    // Teachers can filter by authorId (typically their own).
    // Prevent a teacher from listing another teacher's drafts.
    if (!session.isAdmin && authorId !== session.id) {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }
    query = query.eq("author_id", authorId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) {
    return NextResponse.json({ error: "Seuls les enseignants peuvent créer des leçons" }, { status: 403 });
  }

  const body = await req.json();
  const { title, subject, age_group, exercises, class_id } = body;
  const classError = await checkClass(session, class_id);
  if (classError) return classError;

  // Identity is derived from the session — the body's author_id is ignored.
  // published_at : les leçons sont visibles des élèves dès leur création.
  const { data, error } = await supabase()
    .from("lessons")
    .insert({ title, subject, age_group, author_id: session.id, class_id, exercises, published_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json();
  const { id, author_id: _ignoredAuthorId, ...updates } = body;
  void _ignoredAuthorId; // never trust the client-supplied author_id
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if ("class_id" in updates) {
    const classError = await checkClass(session, updates.class_id);
    if (classError) return classError;
  }

  // L'éditeur n'envoie que les blocs : le diaporama du cours en direct
  // (exercises.live, voir lib/lessonDeck) est conservé.
  if (updates.exercises) {
    const { data: current } = await supabase().from("lessons").select("exercises").eq("id", id).single();
    updates.exercises = { ...(current?.exercises ?? {}), ...updates.exercises };
  }

  let query = supabase().from("lessons").update(updates).eq("id", id);
  // Teachers can only patch their own lessons; admins can patch any.
  if (!session.isAdmin) query = query.eq("author_id", session.id);

  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}) as { id?: string });
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  let query = supabase().from("lessons").delete().eq("id", id);
  // Teachers can only delete their own lessons; admins can delete any.
  if (!session.isAdmin) query = query.eq("author_id", session.id);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
