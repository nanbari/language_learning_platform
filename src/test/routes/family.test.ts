import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, uuid, json, assertAbsent } from "@/test/http";
import { COOKIE_NAME, verifySession, type SessionUser } from "@/server/auth";

vi.mock("@/server/supabase", () => fakeSupabaseModule());

import { GET as authGet, POST as authPost } from "@/app/api/auth/route";

/**
 * Compte famille (lib/family) : l'adresse et le mot de passe du parent ouvrent
 * le profil du premier enfant inscrit et ceux de ses frères et sœurs rattachés ;
 * on change de profil sans mot de passe, mais seulement à l'intérieur de la famille.
 */
const db = fakeDb();
const ADAM = makeUser(1, "student", false, "Adam");          // porte le compte famille
const INES = makeUser(2, "student", false, "Inès");          // rattachée à Adam
const NOUR = makeUser(3, "student", false, "Nour");          // rattachée à Adam, désactivée
const ZOE = makeUser(4, "student", false, "Zoé");            // autre famille, seule
const YANIS = makeUser(5, "student", false, "Yanis");        // rattaché à Omar (troisième famille)
const OMAR = makeUser(6, "student", false, "Omar");          // porte la troisième famille
const T = makeUser(10, "teacher", false, "M. Uzun");
const M = makeUser(20, "teacher", true, "Mme Tahar");
const PARENT = "lea@example.be";
const PASSWORD = "mot-de-passe-de-test";

beforeEach(() => {
  db.reset();
  db.seed("users", [
    profileRow(ADAM, { email: PARENT, created_at: "2026-01-01T00:00:00Z" }),
    profileRow(INES, { family_account_id: ADAM.id, created_at: "2026-01-02T00:00:00Z" }),
    profileRow(NOUR, { family_account_id: ADAM.id, created_at: "2026-01-03T00:00:00Z", disabled_at: "2026-06-01T00:00:00Z" }),
    profileRow(ZOE),
    profileRow(OMAR),
    profileRow(YANIS, { family_account_id: OMAR.id }),
    profileRow(T),
    profileRow(M),
  ]);
  db.passwords.set(PARENT, { id: ADAM.id, password: PASSWORD });
  db.passwords.set(ZOE.email, { id: ZOE.id, password: PASSWORD });
  db.passwords.set(T.email, { id: T.id, password: PASSWORD });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const login = async (email: string, password = PASSWORD) =>
  authPost(await request("POST", "/api/auth", { body: { action: "login", email, password } }));
const choose = async (id: unknown, as?: SessionUser | null, ttl?: number) =>
  authPost(await request("POST", "/api/auth", { as, ttl, body: { action: "profile", id } }));
const sessionOf = async (res: { cookies: { get(name: string): { value: string } | undefined } }) =>
  verifySession(res.cookies.get(COOKIE_NAME)?.value);

describe("connexion d'une famille", () => {
  it("l'adresse du parent ouvre le premier profil et propose les profils actifs de la famille, eux seuls", async () => {
    const res = await login(PARENT);
    expect(res.status).toBe(200);
    const body = await json(res) as unknown as { user: SessionUser; profiles: { id: string; name: string }[] };
    expect(body.user.id).toBe(ADAM.id);
    expect(body.profiles).toEqual([{ id: ADAM.id, name: "Adam" }, { id: INES.id, name: "Inès" }]);
    await assertAbsent(res, ["Nour", "Zoé", "Omar", "Yanis", INES.email]);
    expect((await sessionOf(res))?.id).toBe(ADAM.id);
  });

  it("mauvais mot de passe : 401, aucun profil révélé", async () => {
    const res = await login(PARENT, "mauvais");
    expect(res.status).toBe(401);
    await assertAbsent(res, ["Adam", "Inès", "profiles"]);
    expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
  });

  it("élève seul ou enseignant : pas de choix de profil", async () => {
    for (const email of [ZOE.email, T.email]) {
      const body = await json(await login(email));
      expect(body.user).toBeTruthy();
      expect(body.profiles).toBeUndefined();
    }
  });

  it("premier enfant désactivé : la famille entre sur le profil encore actif ; tous désactivés : refus", async () => {
    db.reset();
    db.seed("users", [
      profileRow(ADAM, { email: PARENT, disabled_at: "2026-06-01T00:00:00Z" }),
      profileRow(INES, { family_account_id: ADAM.id }),
    ]);
    db.passwords.set(PARENT, { id: ADAM.id, password: PASSWORD });
    const res = await login(PARENT);
    expect(res.status).toBe(200);
    expect((await sessionOf(res))?.id).toBe(INES.id);
    expect((await json(res)).profiles).toBeUndefined();

    db.reset();
    db.seed("users", [
      profileRow(ADAM, { email: PARENT, disabled_at: "2026-06-01T00:00:00Z" }),
      profileRow(INES, { family_account_id: ADAM.id, disabled_at: "2026-06-01T00:00:00Z" }),
    ]);
    db.passwords.set(PARENT, { id: ADAM.id, password: PASSWORD });
    expect((await login(PARENT)).status).toBe(401);
  });

  it("GET /api/auth indique les profils de la famille à un élève, jamais à l'équipe", async () => {
    const mine = await json(await authGet(await request("GET", "/api/auth", { as: INES })));
    expect(mine.profiles).toEqual([{ id: ADAM.id, name: "Adam" }, { id: INES.id, name: "Inès" }]);
    expect((await json(await authGet(await request("GET", "/api/auth", { as: ZOE })))).profiles).toBeUndefined();
    expect((await json(await authGet(await request("GET", "/api/auth", { as: M })))).profiles).toBeUndefined();
  });
});

describe("POST /api/auth { action: \"profile\" } — changer de profil dans la famille", () => {
  it("dans la famille, dans les deux sens : la session devient celle du profil choisi, sans être prolongée", async () => {
    const res = await choose(INES.id, ADAM, 600);
    expect(res.status).toBe(200);
    const session = (await sessionOf(res))!;
    expect(session).toMatchObject({ id: INES.id, name: "Inès", role: "student", isAdmin: false });
    expect(session.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 600);

    const back = await choose(ADAM.id, INES);
    expect(back.status).toBe(200);
    expect((await sessionOf(back))?.id).toBe(ADAM.id);
  });

  it("anonyme : 401 ; identifiant invalide : 400", async () => {
    expect((await choose(INES.id)).status).toBe(401);
    expect((await choose("pas-un-uuid", ADAM)).status).toBe(400);
    expect((await choose(undefined, ADAM)).status).toBe(400);
  });

  it("hors de la famille : 403, même réponse qu'un profil inexistant, et la session ne change pas", async () => {
    const targets = [ZOE.id, OMAR.id, YANIS.id, T.id, M.id, NOUR.id, uuid(999)];
    for (const id of targets) {
      const res = await choose(id, ADAM);
      expect(res.status).toBe(403);
      expect((await json(res)).error).toBe("Ce profil n'est pas disponible");
      expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
      await assertAbsent(res, ["Zoé", "Omar", "Yanis", "Uzun", "Tahar", "Nour"]);
    }
  });

  it("un élève d'une autre famille, un enseignant ou un admin ne peuvent ouvrir aucun profil élève", async () => {
    for (const who of [ZOE, OMAR, YANIS, T, M]) {
      for (const id of [ADAM.id, INES.id]) {
        const res = await choose(id, who);
        expect(res.status).toBe(403);
        expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
      }
    }
  });

  it("jamais vers un compte de l'équipe, même rattaché par erreur en base", async () => {
    db.reset();
    db.seed("users", [
      profileRow(ADAM, { email: PARENT }),
      profileRow(T, { family_account_id: ADAM.id }),
      profileRow(makeUser(30, "student", true, "Élève admin"), { family_account_id: ADAM.id }),
    ]);
    expect((await choose(T.id, ADAM)).status).toBe(403);
    expect((await choose(uuid(30), ADAM)).status).toBe(403);
  });

  it("profil désactivé : il ne peut plus changer de profil ; détaché : il sort de la famille aussitôt", async () => {
    expect((await choose(ADAM.id, NOUR)).status).toBe(403);

    // Inès est détachée par un admin : sa session encore valide n'ouvre plus Adam, ni l'inverse.
    db.tables.get("users")!.find((u) => u.id === INES.id)!.family_account_id = null;
    expect((await choose(ADAM.id, INES)).status).toBe(403);
    expect((await choose(INES.id, ADAM)).status).toBe(403);
  });

  it("base illisible : refus 503, sans détail interne ni nouvelle session", async () => {
    db.failNext("users", "select", { message: 'relation "public.users" does not exist', code: "42P01" });
    const res = await choose(INES.id, ADAM);
    expect(res.status).toBe(503);
    await assertAbsent(res, ["relation", "public.users", "42P01"]);
    expect(res.cookies.get(COOKIE_NAME)?.value ?? "").toBe("");
  });
});
