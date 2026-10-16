import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession, isStaff } from "@/lib/auth";
import { isLive, parseNewClass, type ClassRow, type LiveClass, type TeacherClasses } from "@/lib/classes";
import { supabase } from "./access";

interface ClassDbRow {
  id: string;
  name: string;
  teacher_id: string;
  live_room: string | null;
  live_started_at: string | null;
  teacher: { name: string } | null;
  class_members: { student_id: string }[];
}

/**
 * GET /api/classes
 * - Enseignant : ses classes (toutes pour un admin) et la liste des élèves
 *   de la plateforme, pour les composer. Réponse : TeacherClasses.
 * - Élève : les cours en direct de ses classes, avec leur salon. Réponse : LiveClass[].
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const db = supabase();

  if (!isStaff(session)) {
    const { data, error } = await db
      .from("class_members")
      .select("class:classes(id, name, live_room, live_started_at, teacher:users!classes_teacher_id_fkey(name))")
      .eq("student_id", session.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const now = Date.now();
    const live: LiveClass[] = [];
    for (const row of (data ?? []) as unknown as { class: Omit<ClassDbRow, "teacher_id" | "class_members"> | null }[]) {
      const c = row.class;
      if (c && c.live_room && isLive(c.live_room, c.live_started_at, now)) {
        live.push({ id: c.id, name: c.name, teacherName: c.teacher?.name ?? "", room: c.live_room });
      }
    }
    return NextResponse.json(live);
  }

  let q = db
    .from("classes")
    .select("id, name, teacher_id, live_room, live_started_at, teacher:users!classes_teacher_id_fkey(name), class_members(student_id)")
    .order("created_at", { ascending: true });
  if (!session.isAdmin) q = q.eq("teacher_id", session.id);

  const [{ data: classes, error }, { data: students, error: studentsError }] = await Promise.all([
    q,
    db.from("users").select("id, name").eq("role", "student").order("name"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 });

  const now = Date.now();
  const body: TeacherClasses = {
    classes: ((classes ?? []) as unknown as ClassDbRow[]).map((c): ClassRow => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      teacherName: c.teacher?.name ?? "",
      studentIds: c.class_members.map((m) => m.student_id),
      live: isLive(c.live_room, c.live_started_at, now),
    })),
    students: (students ?? []) as { id: string; name: string }[],
  };
  return NextResponse.json(body);
}

/** POST /api/classes — { name } : nouvelle classe de l'enseignant connecté. */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const parsed = parseNewClass(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase()
    .from("classes")
    .insert({ teacher_id: session.id, name: parsed.value.name })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
