import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { isStaff, type SessionUser } from "@/server/auth";
import { ownedClass, studentClassIds } from "@/server/classAccess";
import { withLiveStale } from "@/server/lessonLiveStale";
import { currentUser } from "@/server/session";
import { isMissingColumn, serverError, warnOnce } from "@/server/errors";
import { collectMediaUrls, deleteObjects } from "@/server/r2";

/**
 * Règle de l'association (novembre 2026) : seuls les administrateurs créent,
 * modifient et suppriment des leçons ; les enseignants les lisent. La
 * condition `author_id` des écritures est conservée par principe.
 */

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
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;

  const { searchParams } = new URL(req.url);
  const authorId = searchParams.get("authorId");

  let query = supabaseAdmin().from("lessons").select("*").order("created_at", { ascending: false });
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
  if (error) return serverError("/api/lessons error", error);

  return NextResponse.json(await withLiveStale((data ?? []) as { id: string; title: string; exercises: unknown }[]));
}

export async function POST(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const body = await req.json();
  const { title, subject, age_group, exercises, class_id } = body;
  const classError = await checkClass(session, class_id);
  if (classError) return classError;

  // Identity is derived from the session — the body's author_id is ignored.
  // published_at : les leçons sont visibles des élèves dès leur création.
  const { data, error } = await supabaseAdmin()
    .from("lessons")
    .insert({ title, subject, age_group, author_id: session.id, class_id, exercises, published_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return serverError("/api/lessons error", error);
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
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
    const { data: current } = await supabaseAdmin().from("lessons").select("exercises").eq("id", id).single();
    updates.exercises = { ...(current?.exercises ?? {}), ...updates.exercises };
  }

  // Enregistrement atomique : la version attendue fait partie du WHERE et
  // l'incrément de la même instruction. 0 ligne = quelqu'un a enregistré
  // entre-temps (409, l'éditeur garde le brouillon) ou leçon inaccessible (404).
  const expected = Number.isInteger(body.version) ? (body.version as number) : null;
  delete updates.version;
  const run = (checkVersion: boolean) => {
    let query = supabaseAdmin().from("lessons").update(checkVersion ? { ...updates, version: expected! + 1 } : updates).eq("id", id);
    if (!session.isAdmin) query = query.eq("author_id", session.id);
    if (checkVersion) query = query.eq("version", expected!);
    return query.select();
  };
  let { data, error } = await run(expected !== null);
  if (error && expected !== null && isMissingColumn(error)) {
    warnOnce("colonne lessons.version absente : enregistrement sans contrôle de version");
    ({ data, error } = await run(false));
  }
  if (error) return serverError("/api/lessons error", error);
  if (!data || data.length === 0) {
    const { data: existing } = await supabaseAdmin().from("lessons").select("id, author_id").eq("id", id).maybeSingle();
    const reachable = existing && (session.isAdmin || existing.author_id === session.id);
    if (reachable && expected !== null) {
      return NextResponse.json({ error: "La leçon a été modifiée ailleurs depuis son ouverture." }, { status: 409 });
    }
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }
  return NextResponse.json(data[0]);
}

export async function DELETE(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}) as { id?: string });
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  let query = supabaseAdmin().from("lessons").delete().eq("id", id);
  // Teachers can only delete their own lessons; admins can delete any.
  if (!session.isAdmin) query = query.eq("author_id", session.id);

  const { data, error } = await query.select("exercises");
  if (error) return serverError("/api/lessons error", error);
  // Les médias de la leçon (images, audios sur R2) partent avec elle — après coup, sans bloquer la réponse.
  const urls = (data ?? []).flatMap((row) => collectMediaUrls(row.exercises));
  if (urls.length > 0) void deleteObjects(urls);
  return NextResponse.json({ ok: true });
}
