import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, uuid, json, assertAbsent } from "@/test/http";

vi.mock("@/server/supabase", () => fakeSupabaseModule());
const r2 = vi.hoisted(() => ({ deleted: [] as string[] }));
vi.mock("@/server/r2", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/r2")>();
  return { ...real, deleteObjects: async (urls: string[]) => { r2.deleted.push(...urls); return urls.length; } };
});

import { PATCH as lessonsPatch, DELETE as lessonsDelete } from "@/app/api/lessons/route";
import { POST as eventsPost } from "@/app/api/events/route";
import { POST as authPost } from "@/app/api/auth/route";
import { POST as enrollmentPost } from "@/app/api/enrollment/route";
import { PUT as vocabPut } from "@/app/api/vocab-sounds/route";

const db = fakeDb();
const A = makeUser(1, "student", false, "Amina");
// Admin : seuls les administrateurs écrivent des leçons (règle de novembre 2026).
const T = makeUser(10, "teacher", true, "Mme Tahar");
const U = makeUser(11, "teacher", false, "M. Uzun");
const CLASS = uuid(100);
const LESSON = uuid(200);
const BASE = "https://pub-test.r2.dev";

beforeEach(() => {
  db.reset(); r2.deleted.length = 0;
  process.env.R2_PUBLIC_BASE_URL = BASE;
  db.seed("users", [A, T, U].map((u) => profileRow(u)));
  db.seed("classes", [{ id: CLASS, name: "Les abeilles", teacher_id: T.id, live_room: null, live_started_at: null, created_at: "2026-01-01" }]);
  db.seed("class_members", [{ class_id: CLASS, student_id: A.id }]);
  db.seed("lessons", [{ id: LESSON, title: "Les fruits", author_id: T.id, class_id: CLASS, version: 3, created_at: "2026-01-03",
    exercises: { blocks: [{ type: "slideshow", slides: [{ imageDataUrl: `${BASE}/media/fruits.webp` }] }], live: { slides: [] } } }]);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete process.env.R2_PUBLIC_BASE_URL; });

const patch = async (body: unknown, as = T) => lessonsPatch(await request("PATCH", "/api/lessons", { as, body }));

describe("PATCH /api/lessons — enregistrement atomique (DATA-04)", () => {
  it("deux éditeurs ouverts sur la version 3 : le second obtient 409 et n'écrase rien", async () => {
    const first = await patch({ id: LESSON, title: "Fruits v4", version: 3 });
    expect(first.status).toBe(200);
    expect((await json(first)).version).toBe(4);
    const second = await patch({ id: LESSON, title: "Fruits concurrent", version: 3 });
    expect(second.status).toBe(409);
    expect((await json(second)).error).toMatch(/modifiée ailleurs/);
    const row = db.rows("lessons")[0]!;
    expect(row.title).toBe("Fruits v4");
    expect(row.version).toBe(4);
    // Écrasement volontaire : sans version.
    const overwrite = await patch({ id: LESSON, title: "Fruits écrasés" });
    expect(overwrite.status).toBe(200);
    expect(db.rows("lessons")[0]!.title).toBe("Fruits écrasés");
  });

  it("le diaporama enregistré (exercises.live) survit à un enregistrement de blocs", async () => {
    const res = await patch({ id: LESSON, exercises: { blocks: [{ type: "text" }] }, version: 3 });
    expect(res.status).toBe(200);
    expect((db.rows("lessons")[0]!.exercises as { live?: unknown }).live).toEqual({ slides: [] });
  });

  it("avant la migration (colonne version absente) : enregistrement sans contrôle, signalé une fois", async () => {
    db.failNext("lessons", "update", { message: 'column "version" of relation "lessons" does not exist', code: "42703" });
    const res = await patch({ id: LESSON, title: "Sans version", version: 3 });
    expect(res.status).toBe(200);
    expect(db.rows("lessons")[0]!.title).toBe("Sans version");
  });

  it("enseignant non admin : refusé avant tout contrôle de version (403, jamais 409)", async () => {
    expect((await patch({ id: LESSON, title: "x", version: 3 }, U)).status).toBe(403);
    expect(db.rows("lessons")[0]!.version).toBe(3);
  });
});

describe("écritures de leçons réservées aux admins (AUTH-15)", () => {
  it("un enseignant non admin ne modifie ni ne supprime une leçon", async () => {
    const before = db.snapshot();
    expect((await patch({ id: LESSON, title: "Piraté" }, U)).status).toBe(403);
    expect((await lessonsDelete(await request("DELETE", "/api/lessons", { as: U, body: { id: LESSON } }))).status).toBe(403);
    expect(db.snapshot()).toEqual(before);
    expect(r2.deleted).toEqual([]);
  });
});

describe("DELETE /api/lessons — médias R2 nettoyés", () => {
  it("supprime la leçon puis ses objets du bucket (et rien d'autre)", async () => {
    const res = await lessonsDelete(await request("DELETE", "/api/lessons", { as: T, body: { id: LESSON } }));
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(db.rows("lessons")).toEqual([]);
    expect(r2.deleted).toEqual([`${BASE}/media/fruits.webp`]);
  });

  it("un élève ne supprime rien et aucun objet n'est touché", async () => {
    const res = await lessonsDelete(await request("DELETE", "/api/lessons", { as: A, body: { id: LESSON } }));
    expect(res.status).toBe(403);
    expect(db.rows("lessons")).toHaveLength(1);
    expect(r2.deleted).toEqual([]);
  });
});

describe("POST /api/events — identifiants et renvoi (DATA-02, DATA-03)", () => {
  const ev = (event_id: string, block = "b1") => ({ event_id, lesson_id: LESSON, block_id: block, exercise_type: "quiz", event_type: "attempt", correct: false });

  it("un lot renvoyé deux fois n'est enregistré qu'une fois ; deux essais distincts le sont deux fois", async () => {
    const batch = { events: [ev(uuid(901)), ev(uuid(902), "b2")] };
    expect((await eventsPost(await request("POST", "/api/events", { as: A, body: batch }))).status).toBe(201);
    expect((await eventsPost(await request("POST", "/api/events", { as: A, body: batch }))).status).toBe(201);
    expect(db.rows("exercise_events")).toHaveLength(2);
    expect((await eventsPost(await request("POST", "/api/events", { as: A, body: { events: [ev(uuid(903))] } }))).status).toBe(201);
    expect(db.rows("exercise_events")).toHaveLength(3);
    expect(db.rows("exercise_events").every((r) => r.user_id === A.id)).toBe(true);
  });

  it("un event_id mal formé est refusé ; sans event_id, l'ancien chemin fonctionne", async () => {
    expect((await eventsPost(await request("POST", "/api/events", { as: A, body: { events: [ev("pas-un-uuid")] } }))).status).toBe(400);
    const legacy = { lesson_id: LESSON, block_id: "b", exercise_type: "quiz", event_type: "attempt" };
    expect((await eventsPost(await request("POST", "/api/events", { as: A, body: { events: [legacy, legacy] } }))).status).toBe(201);
    expect(db.rows("exercise_events")).toHaveLength(2);
  });

  it("avant la migration (colonne event_id absente) : enregistré sans identifiant", async () => {
    db.failNext("exercise_events", "upsert", { message: 'column "event_id" of relation "exercise_events" does not exist', code: "42703" });
    expect((await eventsPost(await request("POST", "/api/events", { as: A, body: { events: [ev(uuid(904))] } }))).status).toBe(201);
    expect(db.rows("exercise_events")).toHaveLength(1);
    expect(db.rows("exercise_events")[0]!.event_id).toBeUndefined();
  });
});

describe("limitation de débit des routes publiques", () => {
  it("connexion : 10 tentatives par IP + e-mail, la 11e reçoit 429 sans détail", async () => {
    const headers = (i: number) => request("POST", "/api/auth", { body: { email: "x@test.invalid", password: "mauvais" + i } });
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) last = await authPost(await headers(i));
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toBe(String(10 * 60));
    await assertAbsent(last!, ["rate_limit", "hits"]);
    // Une autre adresse e-mail depuis la même IP n'est pas bloquée.
    const other = await authPost(await request("POST", "/api/auth", { body: { email: "y@test.invalid", password: "mauvais" } }));
    expect(other.status).toBe(401);
  });

  it("demande d'inscription : 5 par heure et par IP", async () => {
    const body = (i: number) => ({
      parentName: "Parent Test", email: `parent${i}@test.invalid`, phone: "+32 470 12 34 56", consent: true,
      children: [{ name: "Enfant Test", age: 7, level: "beginner", letters: "none", vocabulary: "none" }],
    });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await enrollmentPost(await request("POST", "/api/enrollment", { body: body(i) }))).status);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(db.rows("enrollment_requests")).toHaveLength(5);
  });

  it("fonction SQL absente (migration pas passée) : on laisse passer, signalé une fois", async () => {
    db.rateLimitFunction = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 12; i++) {
      expect((await authPost(await request("POST", "/api/auth", { body: { email: "x@test.invalid", password: "m" } }))).status).toBe(401);
    }
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("rate-limit")).length).toBeLessThanOrEqual(1);
  });
});

describe("remplacement d'un son : l'ancien objet est effacé", () => {
  it("PUT /api/vocab-sounds supprime l'enregistrement précédent du mot, pas le nouveau", async () => {
    db.seed("vocab_sounds", [{ word_id: "a1", url: `${BASE}/media/old.mp3` }]);
    const res = await vocabPut(await request("PUT", "/api/vocab-sounds", { as: T, body: { wordId: "a1", url: `${BASE}/media/new.mp3` } }));
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(r2.deleted).toEqual([`${BASE}/media/old.mp3`]);
    expect(db.rows("vocab_sounds")[0]!.url).toBe(`${BASE}/media/new.mp3`);
  });
});
