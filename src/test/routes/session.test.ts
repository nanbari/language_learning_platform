import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDb, fakeSupabaseModule } from "@/test/fakeSupabase";
import { request, makeUser, profileRow, json, assertAbsent } from "@/test/http";
import { COOKIE_NAME, signSession } from "@/server/auth";

vi.mock("@/server/supabase", () => fakeSupabaseModule());

import { currentUser, requireAdmin, requireStaff } from "@/server/session";
import { GET as authGet } from "@/app/api/auth/route";

const db = fakeDb();
const student = makeUser(1, "student");
const teacher = makeUser(2, "teacher");
const admin = makeUser(3, "teacher", true);

beforeEach(() => {
  db.reset();
  db.seed("users", [profileRow(student), profileRow(teacher), profileRow(admin)]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const asError = (auth: Awaited<ReturnType<typeof currentUser>>) => ("error" in auth ? auth.error : null);

describe("currentUser — session autoritaire (AUTH-03, AUTH-13)", () => {
  it("refuse sans cookie, avec un cookie falsifié ou expiré", async () => {
    expect(asError(await currentUser(await request("GET", "/api/x")))?.status).toBe(401);
    const forged = (await signSession(student)).replace(/\.[^.]+$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(asError(await currentUser(await request("GET", "/api/x", { cookie: forged })))?.status).toBe(401);
    expect(asError(await currentUser(await request("GET", "/api/x", { as: student, ttl: -10 })))?.status).toBe(401);
  });

  it("accepte une session valide et prend rôle et droits dans la base, pas dans le cookie", async () => {
    // Le cookie prétend « admin » ; la base dit enseignant sans droit admin.
    const stale = { ...teacher, isAdmin: true, name: "Ancien nom" };
    const auth = await currentUser(await request("GET", "/api/x", { as: stale }));
    expect("user" in auth && auth.user).toMatchObject({ id: teacher.id, isAdmin: false, role: "teacher", name: teacher.name });
    expect(asError(await requireAdmin(await request("GET", "/api/x", { as: stale })))?.status).toBe(403);
  });

  it("un élève promu enseignant en base l'est à la requête suivante, sans nouveau cookie", async () => {
    db.reset();
    db.seed("users", [profileRow({ ...student, role: "teacher" })]);
    const auth = await requireStaff(await request("GET", "/api/x", { as: student }));
    expect("user" in auth && auth.user.role).toBe("teacher");
  });

  it("un compte supprimé est déconnecté : 401 et cookie effacé", async () => {
    db.reset();
    const err = asError(await currentUser(await request("GET", "/api/x", { as: student })))!;
    expect(err.status).toBe(401);
    expect(err.cookies.get(COOKIE_NAME)).toMatchObject({ value: "", maxAge: 0 });
  });

  it("un compte désactivé est refusé (403) même avec un cookie encore valable sept jours", async () => {
    db.reset();
    db.seed("users", [profileRow(student, { disabled_at: "2026-10-28T10:00:00Z" })]);
    const err = asError(await currentUser(await request("GET", "/api/x", { as: student, ttl: 7 * 24 * 3600 })))!;
    expect(err.status).toBe(403);
    expect((await err.json()).error).toBe("Compte désactivé");
    expect(err.cookies.get(COOKIE_NAME)?.value).toBe("");
  });

  it("refuse (503) sans révéler l'erreur quand le profil ne peut pas être lu — jamais de repli sur le cookie (AUTH-14)", async () => {
    db.failNext("users", "select", { message: 'relation "public.users" does not exist', code: "42P01" });
    const err = asError(await currentUser(await request("GET", "/api/x", { as: admin })))!;
    expect(err.status).toBe(503);
    await assertAbsent(err, ["relation", "public.users", "42P01"]);
  });
});

describe("GET /api/auth — rafraîchissement de la session", () => {
  it("renvoie le profil courant et réémet le cookie si les droits ont changé", async () => {
    const stale = { ...teacher, isAdmin: true };
    const res = await authGet(await request("GET", "/api/auth", { as: stale }));
    expect((await json(res)).user).toMatchObject({ id: teacher.id, isAdmin: false });
    expect(res.cookies.get(COOKIE_NAME)?.value).toBeTruthy();
  });

  it("clôt la session d'un compte désactivé ou disparu", async () => {
    db.reset();
    db.seed("users", [profileRow(student, { disabled_at: "2026-10-28T10:00:00Z" })]);
    const res = await authGet(await request("GET", "/api/auth", { as: student }));
    expect((await json(res)).user).toBeNull();
    expect(res.cookies.get(COOKIE_NAME)).toMatchObject({ value: "", maxAge: 0 });
  });
});
