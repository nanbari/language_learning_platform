import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
const supabase = supabaseAdmin();

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(COOKIE_NAME)?.value);
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const authorId = searchParams.get("authorId");

  let query = supabase.from("lessons").select("*").order("created_at", { ascending: false });
  // Teachers can filter by authorId (typically their own); students see everything published.
  if (authorId) {
    // Prevent a teacher from listing another teacher's drafts.
    if (session.role === "teacher" && authorId !== session.id) {
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
  if (session.role !== "teacher" && session.role !== "admin") {
    return NextResponse.json({ error: "Seuls les enseignants peuvent créer des leçons" }, { status: 403 });
  }

  const body = await req.json();
  const { title, subject, age_group, exercises } = body;

  // Identity is derived from the session — the body's author_id is ignored.
  const { data, error } = await supabase
    .from("lessons")
    .insert({ title, subject, age_group, author_id: session.id, exercises })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "teacher" && session.role !== "admin") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json();
  const { id, author_id: _ignoredAuthorId, ...updates } = body;
  void _ignoredAuthorId; // never trust the client-supplied author_id
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  let query = supabase.from("lessons").update(updates).eq("id", id);
  // Teachers can only patch their own lessons; admins can patch any.
  if (session.role === "teacher") query = query.eq("author_id", session.id);

  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  return NextResponse.json(data);
}
