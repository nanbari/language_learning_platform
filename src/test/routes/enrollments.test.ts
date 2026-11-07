import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, uuid, json, assertAbsent } from "@/test/http";

vi.mock("@/server/supabase", () => fakeSupabaseModule());

import { GET as enrollmentsGet, POST as enrollmentsPost } from "@/app/api/admin/enrollments/route";

const db = fakeDb();
const A = makeUser(1, "student", false, "Amina");
const T = makeUser(10, "teacher", false, "M. Uzun");
const M = makeUser(20, "teacher", true, "Mme Tahar");
const NEW = uuid(300);
const ENROLLED = uuid(301);
const ENDED = uuid(302);
const CLOSED = uuid(303);

const row = (id: string, extra: Record<string, unknown>) => ({
  id, parent_name: "Léa Martin", email: "lea@example.be", phone: "+32 470 12 34 56", child_name: "Adam", child_age: 7,
  level: "beginner", letters: "none", known_letters: [], letter_forms: null, known_letter_forms: [], vocabulary: "none",
  vocabulary_domains: [], vocabulary_other: null, consent_at: "2026-01-01T00:00:00Z", status: "new",
  created_at: "2026-01-01T00:00:00Z", handled_at: null, handled_by: null, ended_at: null, ...extra,
});

beforeEach(() => {
  db.reset();
  db.seed("users", [A, T, M].map((u) => profileRow(u)));
  db.seed("enrollment_requests", [
    row(NEW, {}),
    row(ENROLLED, { status: "enrolled", handled_at: "2026-02-01T00:00:00Z", handled_by: M.id }),
    row(ENDED, { status: "enrolled", handled_at: "2026-02-02T00:00:00Z", handled_by: M.id, ended_at: "2026-06-01T00:00:00Z" }),
    row(CLOSED, { status: "closed", handled_at: "2026-02-03T00:00:00Z", handled_by: M.id }),
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const get = async (as?: typeof A) => enrollmentsGet(await request("GET", "/api/admin/enrollments", { as }));
const post = async (body: unknown, as: typeof A = M) => enrollmentsPost(await request("POST", "/api/admin/enrollments", { as, body }));
const find = (id: string) => db.rows("enrollment_requests").find((r) => r.id === id)!;

describe("GET /api/admin/enrollments — administrateurs seulement", () => {
  it("anonyme 401, élève et enseignant non admin 403, sans aucune coordonnée", async () => {
    expect((await get()).status).toBe(401);
    for (const who of [A, T]) {
      const res = await get(who);
      expect(res.status).toBe(403);
      await assertAbsent(res, ["lea@example.be", "Léa", "470"]);
    }
  });

  it("admin : trois listes, l'inscription terminée reste parmi les inscrits avec sa date de fin", async () => {
    const res = await get(M);
    expect(res.status).toBe(200);
    const body = await json(res) as unknown as { pending: { id: string }[]; enrolled: { id: string; ended_at: string | null }[]; closed: { id: string }[] };
    expect(body.pending.map((r) => r.id)).toEqual([NEW]);
    expect(body.enrolled.map((r) => r.id).sort()).toEqual([ENROLLED, ENDED].sort());
    expect(body.enrolled.find((r) => r.id === ENDED)!.ended_at).toBe("2026-06-01T00:00:00Z");
    expect(body.closed.map((r) => r.id)).toEqual([CLOSED]);
  });
});

describe("POST /api/admin/enrollments — décisions (inscrit, sans suite, fin d'inscription)", () => {
  it("non admin : 403 et rien ne change", async () => {
    const before = db.snapshot();
    for (const who of [A, T]) {
      for (const action of ["enroll", "close", "end"]) {
        expect((await post({ id: NEW, action }, who)).status).toBe(403);
      }
    }
    expect((await enrollmentsPost(await request("POST", "/api/admin/enrollments", { body: { id: NEW, action: "enroll" } }))).status).toBe(401);
    expect(db.snapshot()).toBe(before);
  });

  it("« inscrit » : la demande passe en enrolled, datée et signée, sans date de fin", async () => {
    const res = await post({ id: NEW, action: "enroll" });
    expect(res.status).toBe(200);
    const r = find(NEW);
    expect(r.status).toBe("enrolled");
    expect(r.handled_by).toBe(M.id);
    expect(typeof r.handled_at).toBe("string");
    expect(r.ended_at).toBeNull();
    // Déjà décidée : plus modifiable par « inscrit » ni « sans suite ».
    expect((await post({ id: NEW, action: "close" })).status).toBe(404);
    expect(find(NEW).status).toBe("enrolled");
  });

  it("« sans suite » : la demande passe en closed, datée", async () => {
    expect((await post({ id: NEW, action: "close" })).status).toBe(200);
    expect(find(NEW).status).toBe("closed");
    expect(typeof find(NEW).handled_at).toBe("string");
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(404);
  });

  it("« fin d'inscription » : seulement pour un enfant inscrit dont l'inscription est en cours", async () => {
    expect((await post({ id: ENROLLED, action: "end" })).status).toBe(200);
    expect(typeof find(ENROLLED).ended_at).toBe("string");
    expect(find(ENROLLED).status).toBe("enrolled");
    // Déjà terminée, sans suite, ou encore à traiter : 404, dates intactes.
    expect((await post({ id: ENDED, action: "end" })).status).toBe(404);
    expect(find(ENDED).ended_at).toBe("2026-06-01T00:00:00Z");
    expect((await post({ id: CLOSED, action: "end" })).status).toBe(404);
    expect(find(CLOSED).ended_at).toBeNull();
    expect((await post({ id: NEW, action: "end" })).status).toBe(404);
    expect(find(NEW).status).toBe("new");
  });

  it("corps invalide : 400, inconnue : 404", async () => {
    expect((await post({ id: NEW })).status).toBe(400);
    expect((await post({ id: NEW, action: "handled" })).status).toBe(400);
    expect((await post({ id: "pas-un-uuid", action: "enroll" })).status).toBe(400);
    expect((await post({ id: uuid(999), action: "enroll" })).status).toBe(404);
  });
});
