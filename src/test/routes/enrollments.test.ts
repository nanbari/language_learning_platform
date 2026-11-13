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
  created_at: "2026-01-01T00:00:00Z", handled_at: null, handled_by: null, ended_at: null, student_id: null, ...extra,
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

  it("« inscrit » : le compte élève est créé au prénom de l'enfant, rôle élève, et l'invitation part à l'adresse de la demande", async () => {
    const res = await post({ id: NEW, action: "enroll" });
    expect(res.status).toBe(200);
    const body = await json(res) as unknown as { request: { student_id: string }; account: unknown };
    expect(body.account).toEqual({ kind: "invited", email: "lea@example.be" });

    const accountId = db.authUsers.get("lea@example.be")!;
    expect(accountId).toBeTruthy();
    const profile = db.rows("users").find((u) => u.id === accountId)!;
    expect(profile).toMatchObject({ email: "lea@example.be", name: "Adam", role: "student" });
    expect(profile.is_admin).toBeUndefined();
    expect(find(NEW).student_id).toBe(accountId);
    expect(body.request.student_id).toBe(accountId);

    // Un seul e-mail, vers la page où l'on choisit le mot de passe.
    expect(db.invitations).toHaveLength(1);
    expect(db.invitations[0]).toMatchObject({ email: "lea@example.be", data: { name: "Adam", role: "student" } });
    expect(db.invitations[0].redirectTo).toMatch(/\/reinitialiser-mot-de-passe$/);
  });

  it("le rôle et le nom du compte ne viennent jamais de la requête", async () => {
    const res = await post({ id: NEW, action: "enroll", role: "teacher", is_admin: true, isAdmin: true, name: "Intrus" });
    expect(res.status).toBe(200);
    const profile = db.rows("users").find((u) => u.id === db.authUsers.get("lea@example.be"))!;
    expect(profile).toMatchObject({ name: "Adam", role: "student" });
    expect(profile.is_admin).toBeUndefined();
    expect(db.invitations[0].data).toEqual({ name: "Adam", role: "student" });
  });

  it("fratrie : l'adresse du parent porte déjà un compte élève → profil rattaché au compte famille, sans e-mail ni mot de passe", async () => {
    // Premier enfant : invitation à l'adresse du parent.
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(200);
    const elder = db.authUsers.get("lea@example.be")!;
    // Deuxième enfant de la même famille (même adresse).
    const SIBLING = uuid(310);
    db.seed("enrollment_requests", [row(SIBLING, { child_name: "Inès", child_age: 6 })]);

    const res = await post({ id: SIBLING, action: "enroll" });
    expect(res.status).toBe(200);
    expect((await json(res)).account).toEqual({ kind: "family", email: "lea@example.be" });
    expect(db.invitations).toHaveLength(1); // seulement celle du premier enfant

    const profile = db.rows("users").find((u) => u.name === "Inès")!;
    expect(profile).toMatchObject({ role: "student", family_account_id: elder });
    expect(profile.is_admin).toBeUndefined();
    expect(String(profile.email)).toMatch(/^eleve-[0-9a-f-]{36}@famille\.monteetsouris\.com$/);
    expect(db.authUsers.get(String(profile.email))).toBe(profile.id);
    expect(find(SIBLING)).toMatchObject({ status: "enrolled", student_id: profile.id, email: "lea@example.be" });
    // Le compte du premier enfant n'est pas touché.
    expect(db.rows("users").find((u) => u.id === elder)).toMatchObject({ email: "lea@example.be", name: "Adam" });
  });

  it("fratrie inscrite au même instant : le compte du premier enfant n'est jamais défait, le second le rejoint", async () => {
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(200);
    const elder = db.authUsers.get("lea@example.be")!;
    const SIBLING = uuid(311);
    db.seed("enrollment_requests", [row(SIBLING, { child_name: "Inès" })]);
    // Deux clics rapprochés : la seconde requête a cherché le profil avant que la
    // première ne l'écrive (ici : recherche par adresse qui ne le trouve pas), et
    // Supabase lui rend le compte déjà invité du premier enfant.
    const elderRow = db.tables.get("users")!.find((u) => u.id === elder)!;
    elderRow.email = "pas-encore-visible@example.be";

    const res = await post({ id: SIBLING, action: "enroll" });
    elderRow.email = "lea@example.be";
    expect(res.status).toBe(200);
    expect((await json(res)).account).toEqual({ kind: "family", email: "lea@example.be" });

    // Le compte et le profil du premier enfant sont intacts, sa demande garde son lien.
    expect(db.authUsers.get("lea@example.be")).toBe(elder);
    expect(db.rows("users").find((u) => u.id === elder)).toMatchObject({ name: "Adam", role: "student" });
    expect(find(NEW).student_id).toBe(elder);
    // Le second a son propre profil, rattaché.
    const sibling = db.rows("users").find((u) => u.name === "Inès")!;
    expect(sibling.family_account_id).toBe(elder);
    expect(find(SIBLING)).toMatchObject({ status: "enrolled", student_id: sibling.id });
  });

  it("fratrie : échec en cours de route → profil et compte rattachés défaits, demande à traiter", async () => {
    db.seed("users", [profileRow({ ...A, email: "lea@example.be" })]);
    db.failNext("enrollment_requests", "update");
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(500);
    expect(db.authUsers.size).toBe(0);
    expect(db.rows("users")).toHaveLength(4);
    expect(find(NEW).status).toBe("new");
  });

  it("jamais de rattachement au compte d'un enseignant ou d'un admin, ni à une adresse saisie par l'admin", async () => {
    // Adresse saisie = celle d'un élève d'une autre famille : refusé, pas rattaché.
    const other = await post({ id: NEW, action: "enroll", accountEmail: A.email });
    expect(other.status).toBe(409);
    // Élève avec droit admin à l'adresse de la demande : refusé aussi.
    db.seed("users", [profileRow({ ...makeUser(50, "student", true), email: "lea@example.be" })]);
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(409);
    expect(db.rows("users").some((u) => u.family_account_id)).toBe(false);
    expect(db.authUsers.size).toBe(0);
    expect(find(NEW).status).toBe("new");
  });

  it("adresse prise par un compte enseignant : 409, rien ne change, puis inscription avec une autre adresse", async () => {
    db.seed("users", [profileRow({ ...T, id: uuid(11), email: "lea@example.be" })]);
    const before = db.snapshot();
    const refused = await post({ id: NEW, action: "enroll" });
    expect(refused.status).toBe(409);
    expect((await json(refused)).code).toBe("email_taken");
    expect(db.snapshot()).toBe(before);
    expect(db.authUsers.size).toBe(0);
    expect(db.invitations).toHaveLength(0);

    expect((await post({ id: NEW, action: "enroll", accountEmail: "pas une adresse" })).status).toBe(400);
    expect(db.snapshot()).toBe(before);

    const res = await post({ id: NEW, action: "enroll", accountEmail: " Adam.Martin@Example.be " });
    expect(res.status).toBe(200);
    expect(db.invitations.map((i) => i.email)).toEqual(["adam.martin@example.be"]);
    expect(find(NEW).status).toBe("enrolled");
    // L'adresse du parent reste celle de la demande.
    expect(find(NEW).email).toBe("lea@example.be");
  });

  it("compte Auth existant à cette adresse : 409 et la demande reste à traiter", async () => {
    db.authUsers.set("lea@example.be", uuid(900));
    const res = await post({ id: NEW, action: "enroll" });
    expect(res.status).toBe(409);
    expect(find(NEW).status).toBe("new");
    expect(db.rows("users")).toHaveLength(3);
  });

  it("e-mail non parti : le compte est créé quand même et le lien est rendu à l'admin seulement", async () => {
    db.smtp = false;
    const res = await post({ id: NEW, action: "enroll" });
    expect(res.status).toBe(200);
    const body = await json(res) as unknown as { account: { kind: string; inviteLink: string } };
    expect(body.account.kind).toBe("link");
    expect(body.account.inviteLink).toContain("type=invite");
    expect(db.invitations).toHaveLength(0);
    expect(find(NEW).status).toBe("enrolled");
    expect(db.rows("users").some((u) => u.id === db.authUsers.get("lea@example.be") && u.role === "student")).toBe(true);
  });

  it("échec en cours de route : le compte créé à l'instant est défait, la demande reste à traiter", async () => {
    // Profil impossible à créer.
    db.failNext("users", "insert");
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(500);
    expect(db.authUsers.size).toBe(0);
    expect(db.rows("users")).toHaveLength(3);
    expect(find(NEW).status).toBe("new");

    // Demande impossible à marquer : profil et compte Auth retirés.
    db.failNext("enrollment_requests", "update");
    const res = await post({ id: NEW, action: "enroll" });
    expect(res.status).toBe(500);
    await assertAbsent(res, ["enrollment_requests", "42P01"]);
    expect(db.authUsers.size).toBe(0);
    expect(db.rows("users")).toHaveLength(3);
    expect(find(NEW)).toMatchObject({ status: "new", handled_at: null, student_id: null });

    // Puis l'admin réessaie : tout passe.
    expect((await post({ id: NEW, action: "enroll" })).status).toBe(200);
    expect(find(NEW).status).toBe("enrolled");
  });

  it("demande déjà décidée ou inconnue : 404, aucun compte, aucun e-mail", async () => {
    for (const id of [ENROLLED, ENDED, CLOSED, uuid(999)]) {
      expect((await post({ id, action: "enroll" })).status).toBe(404);
    }
    expect(db.authUsers.size).toBe(0);
    expect(db.invitations).toHaveLength(0);
    expect(db.rows("users")).toHaveLength(3);
  });

  it("non admin : aucun compte créé, aucun e-mail envoyé", async () => {
    for (const who of [A, T]) expect((await post({ id: NEW, action: "enroll", accountEmail: "x@example.be" }, who)).status).toBe(403);
    expect(db.authUsers.size).toBe(0);
    expect(db.invitations).toHaveLength(0);
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
