import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, uuid, json, params, assertAbsent } from "@/test/http";

vi.mock("@/server/supabase", () => fakeSupabaseModule());

import { GET as eventsGet, POST as eventsPost } from "@/app/api/events/route";
import { GET as progressGet } from "@/app/api/progress/route";
import { GET as summaryGet } from "@/app/api/practice/summary/route";
import { GET as lessonsGet, POST as lessonsPost, PATCH as lessonsPatch, DELETE as lessonsDelete } from "@/app/api/lessons/route";
import { POST as liveDeckPost } from "@/app/api/live-deck/route";
import { GET as classesGet, POST as classesPost } from "@/app/api/classes/route";
import { PATCH as classPatch, DELETE as classDelete } from "@/app/api/classes/[id]/route";
import { GET as staffGet, POST as staffPost } from "@/app/api/admin/staff/route";
import { PUT as letterSoundPut } from "@/app/api/letter-sounds/route";
import { PUT as vocabSoundPut } from "@/app/api/vocab-sounds/route";
import { GET as healthGet } from "@/app/api/health/route";

const db = fakeDb();
const A = makeUser(1, "student", false, "Amina");
const B = makeUser(2, "student", false, "Bilal");
const C = makeUser(3, "student", false, "Chadi");       // autre classe
const T = makeUser(10, "teacher", false, "Mme Tahar");  // enseignante de la classe
const U = makeUser(11, "teacher", false, "M. Uzun");    // enseignant sans lien
const ADMIN = makeUser(12, "teacher", true, "Admin");
const CLASS = uuid(100);
const OTHER_CLASS = uuid(101);
const LESSON = uuid(200);
const OTHER_LESSON = uuid(201);

beforeEach(() => {
  db.reset();
  db.seed("users", [A, B, C, T, U, ADMIN].map((u) => profileRow(u)));
  db.seed("classes", [
    { id: CLASS, name: "Les abeilles", teacher_id: T.id, live_room: null, live_started_at: null, created_at: "2026-01-01" },
    { id: OTHER_CLASS, name: "Les fourmis", teacher_id: U.id, live_room: null, live_started_at: null, created_at: "2026-01-02" },
  ]);
  db.seed("class_members", [
    { class_id: CLASS, student_id: A.id }, { class_id: CLASS, student_id: B.id }, { class_id: OTHER_CLASS, student_id: C.id },
  ]);
  db.seed("lessons", [
    { id: LESSON, title: "Les fruits", author_id: T.id, class_id: CLASS, exercises: { blocks: [] }, created_at: "2026-01-03" },
    { id: OTHER_LESSON, title: "Secret des fourmis", author_id: U.id, class_id: OTHER_CLASS, exercises: { blocks: [] }, created_at: "2026-01-04" },
  ]);
  db.seed("exercise_events", [
    { id: 1, user_id: A.id, lesson_id: LESSON, block_id: "b1:quiz:0", kind: "answer", correct: true, created_at: "2026-01-05T10:00:00Z" },
    { id: 2, user_id: B.id, lesson_id: LESSON, block_id: "b1:quiz:0", kind: "answer", correct: false, created_at: "2026-01-05T10:01:00Z" },
  ]);
  db.seed("progress", [{ id: 1, user_id: B.id, lesson_id: LESSON, score: 80 }]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("anonyme (AUTH-02)", () => {
  it("chaque route privée refuse sans rien changer", async () => {
    const before = db.snapshot();
    for (const [handler, method, path, body] of [
      [eventsGet, "GET", "/api/events"], [progressGet, "GET", "/api/progress"], [lessonsGet, "GET", "/api/lessons"],
      [classesGet, "GET", "/api/classes"], [staffGet, "GET", "/api/admin/staff"],
      [eventsPost, "POST", "/api/events", { events: [{ lesson_id: LESSON, block_id: "b", exercise_type: "quiz", event_type: "attempt", correct: true }] }],
      [classesPost, "POST", "/api/classes", { name: "x" }],
      [letterSoundPut, "PUT", "/api/letter-sounds", { letterId: 1, url: "https://x" }],
    ] as const) {
      const res = await (handler as unknown as (r: NextRequest) => Promise<Response>)(await request(method, path, body ? { body } : {}));
      expect(res.status, path).toBe(401);
    }
    expect(db.snapshot()).toBe(before);
  });
});

describe("élève A contre élève B, même classe (AUTH-05, AUTH-07)", () => {
  it("A ne lit ni les événements, ni la progression, ni les révisions de B — et rien de B ne transparaît", async () => {
    for (const [handler, path] of [
      [eventsGet, `/api/events?userId=${B.id}`], [progressGet, `/api/progress?userId=${B.id}`], [summaryGet, `/api/practice/summary?userId=${B.id}`],
    ] as const) {
      const res = await (handler as unknown as (r: NextRequest) => Promise<Response>)(await request("GET", path, { as: A }));
      expect(res.status, path).toBe(403);
      await assertAbsent(res, [B.id, "Bilal", "80", "quiz"]);
    }
  });

  it("A lit ses propres événements, et seulement les siens (AUTH-16, AUTH-10)", async () => {
    const res = await eventsGet(await request("GET", "/api/events", { as: A }));
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { user_id: string }[];
    expect(rows.map((r) => r.user_id)).toEqual([A.id]);
    // Même en demandant « tout » par un filtre vide, un élève ne sort pas de lui-même.
    const all = (await (await eventsGet(await request("GET", "/api/events?lessonId=" + LESSON, { as: A }))).json()) as { user_id: string }[];
    expect(all.every((r) => r.user_id === A.id)).toBe(true);
  });

  it("un événement envoyé avec le user_id de B est enregistré au nom de A", async () => {
    const res = await eventsPost(await request("POST", "/api/events", { as: A, body: { events: [
      { lesson_id: LESSON, block_id: "b1:quiz:1", exercise_type: "quiz", event_type: "attempt", correct: true, user_id: B.id },
    ] } }));
    expect(res.status).toBe(201);
    const inserted = db.rows("exercise_events").filter((r) => r.block_id === "b1:quiz:1");
    expect(inserted).toHaveLength(1);
    expect(inserted[0].user_id).toBe(A.id);
  });

  it("A ne voit que les leçons de ses classes (AUTH-06)", async () => {
    const res = await lessonsGet(await request("GET", "/api/lessons", { as: A }));
    const rows = (await res.clone().json()) as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual([LESSON]);
    await assertAbsent(res, ["Secret des fourmis"]);
  });
});

describe("élève contre opérations réservées (AUTH-04, DATA-08)", () => {
  it("création de classe, modification de leçon, droits admin, sons : refusés sans effet", async () => {
    const before = db.snapshot();
    expect((await classesPost(await request("POST", "/api/classes", { as: A, body: { name: "Ma classe" } }))).status).toBe(403);
    expect((await lessonsPatch(await request("PATCH", "/api/lessons", { as: A, body: { id: LESSON, title: "Piraté" } }))).status).toBe(403);
    expect((await staffPost(await request("POST", "/api/admin/staff", { as: A, body: { id: T.id, isAdmin: true } }))).status).toBe(403);
    expect((await letterSoundPut(await request("PUT", "/api/letter-sounds", { as: A, body: { letterId: 1, url: "https://x" } }))).status).toBe(403);
    expect((await vocabSoundPut(await request("PUT", "/api/vocab-sounds", { as: A, body: { wordId: "a1", url: "https://x" } }))).status).toBe(403);
    expect(db.snapshot()).toBe(before);
  });
});

describe("enseignant sans lien avec la classe (AUTH-11)", () => {
  it("ne modifie ni ne supprime la classe d'un autre, et ne sait pas qu'elle existe", async () => {
    const before = db.snapshot();
    const patch = await classPatch(await request("PATCH", `/api/classes/${CLASS}`, { as: U, body: { name: "Volée" } }), params(CLASS));
    expect(patch.status).toBe(404);
    const del = await classDelete(await request("DELETE", `/api/classes/${CLASS}`, { as: U }), params(CLASS));
    expect(del.status).toBe(404);
    await assertAbsent(patch, ["Les abeilles", T.id]);
    expect(db.snapshot()).toBe(before);
  });

  it("l'enseignante de la classe la renomme (AUTH-16)", async () => {
    const res = await classPatch(await request("PATCH", `/api/classes/${CLASS}`, { as: T, body: { name: "Les abeilles 2" } }), params(CLASS));
    expect(res.status).toBe(200);
    expect(db.rows("classes").find((c) => c.id === CLASS)?.name).toBe("Les abeilles 2");
  });

  it("un enseignant n'a pas les routes admin ; l'admin les a", async () => {
    expect((await staffGet(await request("GET", "/api/admin/staff", { as: T }))).status).toBe(403);
    expect((await staffGet(await request("GET", "/api/admin/staff", { as: ADMIN }))).status).toBe(200);
  });
});

describe("cookie périmé par un changement de droits (AUTH-13)", () => {
  it("un ancien cookie « admin » ne donne plus les routes admin une fois le droit retiré en base", async () => {
    const oldCookie = { ...T, isAdmin: true }; // ce que le cookie prétend encore
    expect((await staffGet(await request("GET", "/api/admin/staff", { as: oldCookie, ttl: 7 * 24 * 3600 }))).status).toBe(403);
  });

  it("un élève retiré de sa classe ne voit plus ses leçons à la requête suivante", async () => {
    db.tables.set("class_members", db.rows("class_members").filter((m) => m.student_id !== A.id));
    const rows = (await (await lessonsGet(await request("GET", "/api/lessons", { as: A }))).json()) as unknown[];
    expect(rows).toEqual([]);
  });
});

describe("pannes de base sans divulgation (AUTH-14)", () => {
  it("une erreur Supabase devient « Erreur serveur » avec une référence", async () => {
    db.failNext("exercise_events", "select", { message: 'permission denied for table exercise_events', code: "42501" });
    const res = await eventsGet(await request("GET", "/api/events", { as: A }));
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body).toMatchObject({ error: "Erreur serveur" });
    expect(typeof body.ref).toBe("string");
    await assertAbsent(res, ["permission denied", "42501", "exercise_events"]);
  });

  it("/api/health?deep=1 ne décrit jamais la panne", async () => {
    db.failNext("lessons", "select", { message: 'relation "public.lessons" does not exist', code: "42P01" });
    const res = await healthGet(await request("GET", "/api/health?deep=1"));
    expect(res.status).toBe(503);
    expect(await json(res)).toMatchObject({ status: "degraded" });
    await assertAbsent(res, ["relation", "lessons", "42P01", "db"]);
    expect((await (await healthGet(await request("GET", "/api/health"))).json())).toEqual({ status: "ok" });
  });
});

describe("écritures de leçons : administrateurs seulement (AUTH-15)", () => {
  it("un enseignant, même auteur, ne crée, ne modifie, ne supprime pas et ne régénère pas le diaporama", async () => {
    const before = db.snapshot();
    const create = await lessonsPost(await request("POST", "/api/lessons", { as: T, body: { title: "X", class_id: CLASS, exercises: { blocks: [] } } }));
    expect(create.status).toBe(403);
    expect((await lessonsPatch(await request("PATCH", "/api/lessons", { as: T, body: { id: LESSON, title: "Changé" } }))).status).toBe(403);
    expect((await lessonsDelete(await request("DELETE", "/api/lessons", { as: T, body: { id: LESSON } }))).status).toBe(403);
    const deck = await liveDeckPost(await request("POST", "/api/live-deck", { as: T, body: { lessonId: OTHER_LESSON } }));
    expect(deck.status).toBe(403);
    expect((await liveDeckPost(await request("POST", "/api/live-deck", { as: A, body: { lessonId: LESSON } }))).status).toBe(403);
    expect(db.snapshot()).toEqual(before);
  });

  it("un admin : leçon inconnue → 404 sans détail, leçon sans contenu → 422", async () => {
    const unknown = await liveDeckPost(await request("POST", "/api/live-deck", { as: ADMIN, body: { lessonId: uuid(999) } }));
    expect(unknown.status).toBe(404);
    await assertAbsent(unknown, ["relation", "lessons", "PGRST"]);
    expect((await liveDeckPost(await request("POST", "/api/live-deck", { as: ADMIN, body: { lessonId: "pas-un-uuid" } }))).status).toBe(404);
    const empty = await liveDeckPost(await request("POST", "/api/live-deck", { as: ADMIN, body: { lessonId: LESSON } }));
    expect(empty.status).toBe(422);
  });
});
