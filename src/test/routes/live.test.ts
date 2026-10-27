import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, uuid, json, params, assertAbsent } from "@/test/http";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import type { LiveState } from "@/lib/liveSession";
import { verifyLiveToken } from "@/server/liveToken";

vi.mock("@/server/supabase", () => fakeSupabaseModule());

import { POST as liveStart, DELETE as liveEnd } from "@/app/api/classes/[id]/live/route";
import { GET as stateGet, PUT as statePut } from "@/app/api/classes/[id]/live/state/route";
import { GET as answersGet, POST as answersPost } from "@/app/api/classes/[id]/live/answers/route";
import { GET as tokenGet } from "@/app/api/classes/[id]/live/token/route";
import { POST as mutePost } from "@/app/api/classes/[id]/live/mute/route";

const db = fakeDb();
const A = makeUser(1, "student", false, "Amina");
const B = makeUser(2, "student", false, "Bilal");
const X = makeUser(3, "student", false, "Xavier");      // pas dans la classe
const T = makeUser(10, "teacher", false, "Mme Tahar");  // enseignante de la classe
const U = makeUser(11, "teacher", false, "M. Uzun");    // autre enseignant
const CLASS = uuid(100);
const ROOM = uuid(500);
const OLD_ROOM = uuid(501);
const JWT_SECRET = "jwt-secret-for-tests-0123456789";

const [alif, ba, ta] = ARABIC_ALPHABET;
const gameState: LiveState = { index: 1, total: 3, step: 0, revealed: false, slide: { kind: "findLetter", target: ba, choices: [alif, ba, ta] } };

const q = (path: string, room = ROOM) => `/api/classes/${CLASS}/live/${path}?room=${room}`;
const P = params(CLASS);

beforeEach(() => {
  db.reset();
  db.seed("users", [A, B, X, T, U].map((u) => profileRow(u)));
  db.seed("classes", [{ id: CLASS, name: "Les abeilles", teacher_id: T.id, live_room: ROOM, live_started_at: new Date().toISOString(), live_state: gameState, live_state_at: new Date().toISOString(), created_at: "2026-01-01" }]);
  db.seed("class_members", [{ class_id: CLASS, student_id: A.id }, { class_id: CLASS, student_id: B.id }]);
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete process.env.SUPABASE_JWT_SECRET; });

describe("le salon ne donne aucun droit (LIVE-01)", () => {
  it("anonyme : 401 partout, sans état ni jeton", async () => {
    for (const [h, m, p] of [[stateGet, "GET", "state"], [tokenGet, "GET", "token"], [answersGet, "GET", "answers"], [answersPost, "POST", "answers"], [statePut, "PUT", "state"], [mutePost, "POST", "mute"]] as const) {
      const res = await (h as unknown as (r: NextRequest, c: typeof P) => Promise<Response>)(await request(m, q(p), { body: {} }), P);
      expect(res.status, p).toBe(401);
      await assertAbsent(res, ["findLetter", "token"]);
    }
  });

  it("un élève hors de la classe, avec le bon salon : 404, aucune donnée", async () => {
    const state = await stateGet(await request("GET", q("state"), { as: X }), P);
    expect(state.status).toBe(404);
    await assertAbsent(state, ["findLetter", "live", "Les abeilles"]);
    const token = await tokenGet(await request("GET", q("token"), { as: X }), P);
    expect(token.status).toBe(404);
    await assertAbsent(token, ["token", "eyJ"]);
    const before = db.snapshot();
    const answer = await answersPost(await request("POST", q("answers"), { as: X, body: { slideIndex: 1, choiceId: String(ba.id) } }), P);
    expect(answer.status).toBe(404);
    expect(db.snapshot()).toBe(before);
    // Un enseignant sans lien non plus.
    expect((await stateGet(await request("GET", q("state"), { as: U }), P)).status).toBe(404);
    expect((await answersGet(await request("GET", q("answers"), { as: U }), P)).status).toBe(404);
  });

  it("un membre avec un salon périmé ou deviné : « terminé », pas l'état", async () => {
    const res = await stateGet(await request("GET", q("state", OLD_ROOM), { as: A }), P);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ status: "ended" });
    expect((await tokenGet(await request("GET", q("token", OLD_ROOM), { as: A }), P)).status).toBe(404);
  });
});

describe("commandes réservées à l'enseignant (LIVE-02, LIVE-03)", () => {
  it("un élève ne dépose pas d'écran, ne coupe pas les micros, ne lit pas les réponses", async () => {
    const before = db.snapshot();
    const forged: LiveState = { ...gameState, index: 2, revealed: true };
    expect((await statePut(await request("PUT", q("state"), { as: A, body: forged }), P)).status).toBe(403);
    expect((await mutePost(await request("POST", q("mute"), { as: A }), P)).status).toBe(403);
    const answers = await answersGet(await request("GET", q("answers"), { as: A }), P);
    expect(answers.status).toBe(403);
    expect(db.snapshot()).toBe(before);
    expect(db.pokes).toEqual([]);
  });

  it("l'enseignante dépose l'écran, coupe les micros, termine : et le serveur signale", async () => {
    const next: LiveState = { ...gameState, index: 2, slide: { kind: "bravo" } };
    expect((await statePut(await request("PUT", q("state"), { as: T, body: next }), P)).status).toBe(200);
    expect(db.rows("classes")[0]!.live_state).toEqual(next);
    expect((await mutePost(await request("POST", q("mute"), { as: T }), P)).status).toBe(200);
    expect(db.pokes.map((p) => p.event)).toEqual(["state", "muteAll"]);
    expect(db.pokes.every((p) => p.topic === `live:${ROOM}:control`)).toBe(true);
  });

  it("un écran mal formé ou trop gros est refusé", async () => {
    expect((await statePut(await request("PUT", q("state"), { as: T, body: { index: 9, total: 3, step: 0, revealed: false, slide: { kind: "bravo" } } }), P)).status).toBe(400);
    expect((await statePut(await request("PUT", q("state"), { as: T, rawBody: "{".padEnd(300 * 1024, " ") }), P)).status).toBe(413);
    expect(db.rows("classes")[0]!.live_state).toEqual(gameState);
  });
});

describe("réponses : identité et exactitude du serveur (AUTH-07, DATA-01)", () => {
  it("l'essai est enregistré au nom de l'élève connecté ; studentId, name et correct envoyés sont ignorés", async () => {
    const res = await answersPost(await request("POST", q("answers"), { as: A, body: {
      slideIndex: 1, choiceId: String(alif.id), studentId: B.id, name: "Bilal", correct: true,
    } }), P);
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({ correct: false });
    const rows = db.rows("live_answers");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ student_id: A.id, choice_id: String(alif.id), correct: false, slide_index: 1, room: ROOM });
  });

  it("un essai sur un autre écran que l'écran courant, ou un choix inconnu, est refusé sans écriture", async () => {
    expect((await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 0, choiceId: String(ba.id) } }), P)).status).toBe(409);
    expect((await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 1, choiceId: "999" } }), P)).status).toBe(400);
    expect((await answersPost(await request("POST", q("answers"), { as: T, body: { slideIndex: 1, choiceId: String(ba.id) } }), P)).status).toBe(403);
    expect(db.rows("live_answers")).toEqual([]);
  });

  it("l'enseignante voit les essais de tous avec leurs prénoms ; un élève ne reçoit jamais ceux des autres (AUTH-05)", async () => {
    await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 1, choiceId: String(alif.id) } }), P);
    await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 1, choiceId: String(ba.id) } }), P);
    await answersPost(await request("POST", q("answers"), { as: B, body: { slideIndex: 1, choiceId: String(ba.id) } }), P);
    await stateGet(await request("GET", q("state"), { as: A }), P); // présence de A

    const host = await answersGet(await request("GET", q("answers"), { as: T }), P);
    expect(host.status).toBe(200);
    const view = await json(host) as { answers: { studentId: string; name: string; correct: boolean }[]; participants: { id: string }[] };
    expect(view.answers.map((a) => [a.name, a.correct])).toEqual([["Amina", false], ["Amina", true], ["Bilal", true]]);
    expect(view.participants.map((p) => p.id)).toEqual([A.id]);

    // Ce que B reçoit en relisant la séance : l'écran, et rien sur Amina.
    const guest = await stateGet(await request("GET", q("state"), { as: B }), P);
    expect(guest.status).toBe(200);
    expect(await json(guest)).toEqual({ status: "live", state: gameState });
    await assertAbsent(guest, ["Amina", A.id, "answers", "correct"]);
  });
});

describe("jeton Realtime (LIVE-01, LIVE-05)", () => {
  it("un membre et l'enseignante obtiennent un jeton lié à eux et au salon, à durée bornée", async () => {
    for (const [who, role] of [[A, "student"], [T, "teacher"]] as const) {
      const res = await tokenGet(await request("GET", q("token"), { as: who }), P);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = await json(res) as { token: string; topics: { control: string; video: string }; teacherId: string; role: string; expiresAt: number };
      const claims = verifyLiveToken(body.token, JWT_SECRET)!;
      expect(claims).toMatchObject({ sub: who.id, ms_room: ROOM, ms_role: role, role: "authenticated" });
      expect(body.topics).toEqual({ control: `live:${ROOM}:control`, video: `live:${ROOM}:video` });
      expect(body.teacherId).toBe(T.id);
      expect(body.expiresAt - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    }
  });

  it("sans secret côté serveur : une vraie session Supabase Auth de la personne, jamais d'un autre", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const res = await tokenGet(await request("GET", q("token"), { as: A }), P);
    expect(res.status).toBe(200);
    const body = await json(res) as { token: string; expiresAt: number; role: string };
    expect(body.token).toBe(`supabase-session:${A.id}`);
    expect(body.role).toBe("student");
    expect(body.expiresAt - Date.now()).toBeLessThanOrEqual(3600 * 1000);
    // Hors de la classe : toujours 404, aucun lien magique généré.
    expect((await tokenGet(await request("GET", q("token"), { as: X }), P)).status).toBe(404);
  });

  it("sans secret et sans Supabase Auth : 503, aucun jeton", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    db.authLinks = false;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await tokenGet(await request("GET", q("token"), { as: A }), P);
    expect(res.status).toBe(503);
    await assertAbsent(res, ["eyJ", "supabase-session", "token\":"]);
  });
});

describe("retrait et fin (LIVE-04, AUTH-13)", () => {
  it("un élève retiré de la classe est refusé à la requête suivante : état, réponses, jeton", async () => {
    expect((await stateGet(await request("GET", q("state"), { as: A }), P)).status).toBe(200);
    db.tables.set("class_members", db.rows("class_members").filter((m) => m.student_id !== A.id));
    const before = db.snapshot();
    expect((await stateGet(await request("GET", q("state"), { as: A }), P)).status).toBe(404);
    expect((await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 1, choiceId: String(ba.id) } }), P)).status).toBe(404);
    expect((await tokenGet(await request("GET", q("token"), { as: A }), P)).status).toBe(404);
    expect(db.snapshot()).toBe(before);
    // B, toujours membre, continue.
    expect((await stateGet(await request("GET", q("state"), { as: B }), P)).status).toBe(200);
  });

  it("terminer le cours efface écran, réponses et présences, et signale la fin ; un ancien onglet ne termine pas un cours relancé", async () => {
    await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 1, choiceId: String(ba.id) } }), P);
    await stateGet(await request("GET", q("state"), { as: A }), P);
    expect(db.rows("live_answers")).toHaveLength(1);

    const stale = await liveEnd(await request("DELETE", q("", OLD_ROOM).replace("/?", "?")), P);
    expect(stale.status).toBe(401); // sans cookie
    expect((await liveEnd(await request("DELETE", `/api/classes/${CLASS}/live?room=${OLD_ROOM}`, { as: T }), P)).status).toBe(200);
    expect(db.rows("classes")[0]!.live_room).toBe(ROOM); // rien n'a changé : mauvais salon
    expect(db.rows("live_answers")).toHaveLength(1);

    expect((await liveEnd(await request("DELETE", `/api/classes/${CLASS}/live?room=${ROOM}`, { as: T }), P)).status).toBe(200);
    expect(db.rows("classes")[0]!).toMatchObject({ live_room: null, live_state: null });
    expect(db.rows("live_answers")).toEqual([]);
    expect(db.rows("live_participants")).toEqual([]);
    expect(db.pokes.at(-1)).toEqual({ topic: `live:${ROOM}:control`, event: "end" });
    expect(await json(await stateGet(await request("GET", q("state"), { as: A }), P))).toEqual({ status: "ended" });
  });

  it("relancer le cours repart d'une séance vide, avec un nouveau salon", async () => {
    await answersPost(await request("POST", q("answers"), { as: A, body: { slideIndex: 1, choiceId: String(ba.id) } }), P);
    expect((await liveStart(await request("POST", `/api/classes/${CLASS}/live`, { as: U }), P)).status).toBe(404);
    const res = await liveStart(await request("POST", `/api/classes/${CLASS}/live`, { as: T }), P);
    expect(res.status).toBe(200);
    const { room } = await json(res) as { room: string };
    expect(room).not.toBe(ROOM);
    expect(db.rows("live_answers")).toEqual([]);
    expect(db.rows("classes")[0]!).toMatchObject({ live_room: room, live_state: null });
  });
});
