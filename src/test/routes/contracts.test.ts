import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, uuid, json, params, assertAbsent } from "@/test/http";

vi.mock("@/server/supabase", () => fakeSupabaseModule());

import { GET as lessonGet } from "@/app/api/lessons/[id]/route";
import { GET as liveClassesGet } from "@/app/api/classes/live/route";
import { GET as classesGet } from "@/app/api/classes/route";

const db = fakeDb();
const A = makeUser(1, "student", false, "Amina");
const C = makeUser(3, "student", false, "Chadi");       // autre classe
const T = makeUser(10, "teacher", false, "Mme Tahar");
const U = makeUser(11, "teacher", false, "M. Uzun");
const CLASS = uuid(100);
const OTHER_CLASS = uuid(101);
const LESSON = uuid(200);
const OTHER_LESSON = uuid(201);
const ROOM = uuid(500);

beforeEach(() => {
  db.reset();
  db.seed("users", [A, C, T, U].map((u) => profileRow(u)));
  db.seed("classes", [
    { id: CLASS, name: "Les abeilles", teacher_id: T.id, live_room: ROOM, live_started_at: new Date().toISOString(), created_at: "2026-01-01" },
    { id: OTHER_CLASS, name: "Les fourmis", teacher_id: U.id, live_room: uuid(501), live_started_at: "2020-01-01T00:00:00Z", created_at: "2026-01-02" },
  ]);
  db.seed("class_members", [{ class_id: CLASS, student_id: A.id }, { class_id: OTHER_CLASS, student_id: C.id }]);
  db.seed("lessons", [
    { id: LESSON, title: "Les fruits", author_id: T.id, class_id: CLASS, exercises: { blocks: [] }, created_at: "2026-01-03" },
    { id: OTHER_LESSON, title: "Secret des fourmis", author_id: U.id, class_id: OTHER_CLASS, exercises: { blocks: [] }, created_at: "2026-01-04" },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/lessons/:id (targeted retrieval)", () => {
  it("anonyme : 401 sans contenu", async () => {
    const res = await lessonGet(await request("GET", `/api/lessons/${LESSON}`), params(LESSON));
    expect(res.status).toBe(401);
    await assertAbsent(res, ["Les fruits"]);
  });

  it("élève de la classe : la leçon avec live_stale ; autre élève : 404 sans fuite", async () => {
    const ok = await lessonGet(await request("GET", `/api/lessons/${LESSON}`, { as: A }), params(LESSON));
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ id: LESSON, title: "Les fruits", live_stale: null });

    const denied = await lessonGet(await request("GET", `/api/lessons/${OTHER_LESSON}`, { as: A }), params(OTHER_LESSON));
    expect(denied.status).toBe(404);
    await assertAbsent(denied, ["Secret des fourmis", U.id]);
  });

  it("identifiant invalide ou leçon absente : 404 ; enseignant : toute leçon (règle actuelle)", async () => {
    expect((await lessonGet(await request("GET", "/api/lessons/x", { as: A }), params("x"))).status).toBe(404);
    expect((await lessonGet(await request("GET", `/api/lessons/${uuid(999)}`, { as: T }), params(uuid(999)))).status).toBe(404);
    expect((await lessonGet(await request("GET", `/api/lessons/${OTHER_LESSON}`, { as: T }), params(OTHER_LESSON))).status).toBe(200);
  });

  it("panne de base : 500 masqué (AUTH-14)", async () => {
    db.failNext("lessons", "select", { message: 'relation "public.lessons" does not exist', code: "42P01" });
    const res = await lessonGet(await request("GET", `/api/lessons/${LESSON}`, { as: T }), params(LESSON));
    expect(res.status).toBe(500);
    await assertAbsent(res, ["relation", "42P01"]);
  });
});

describe("GET /api/classes/live (student contract)", () => {
  it("élève : ses cours en direct seulement (cours expiré exclu) ; même contenu que l'ancienne forme de /api/classes", async () => {
    const res = await liveClassesGet(await request("GET", "/api/classes/live", { as: A }));
    expect(res.status).toBe(200);
    const list = await res.clone().json() as unknown[];
    expect(list).toEqual([{ id: CLASS, name: "Les abeilles", teacherName: "Mme Tahar", room: ROOM }]);
    const legacy = await classesGet(await request("GET", "/api/classes", { as: A }));
    expect(await legacy.json()).toEqual(list);

    // C : sa classe a un cours vieux de six ans → rien, et rien de la classe d'Amina.
    const other = await liveClassesGet(await request("GET", "/api/classes/live", { as: C }));
    expect(await other.clone().json()).toEqual([]);
    await assertAbsent(other, [ROOM, "Les abeilles"]);
  });

  it("anonyme 401, enseignant 403 (réservé aux élèves)", async () => {
    expect((await liveClassesGet(await request("GET", "/api/classes/live"))).status).toBe(401);
    const res = await liveClassesGet(await request("GET", "/api/classes/live", { as: T }));
    expect(res.status).toBe(403);
    await assertAbsent(res, [ROOM]);
  });
});
