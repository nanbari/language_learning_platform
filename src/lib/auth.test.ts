import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession, type SessionUser } from "./auth";

const user: SessionUser = {
  id: "u-123",
  email: "eleve@example.com",
  name: "Élève Test",
  role: "student",
  isAdmin: false,
};

beforeAll(() => {
  process.env.AUTH_SECRET = "vitest-secret-0123456789abcdef";
});

describe("signSession / verifySession", () => {
  it("signe puis vérifie une session valide (aller-retour)", async () => {
    const token = await signSession(user);
    const session = await verifySession(token);
    expect(session).not.toBeNull();
    expect(session).toMatchObject(user);
    expect(session!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejette un token falsifié (payload modifié)", async () => {
    const token = await signSession(user);
    const [payload, sig] = [token.slice(0, token.lastIndexOf(".")), token.slice(token.lastIndexOf(".") + 1)];
    const forged = Buffer.from(JSON.stringify({ ...user, role: "admin", exp: 9999999999 }))
      .toString("base64url");
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
    expect(payload).not.toBe(forged);
  });

  it("rejette un token à signature tronquée ou altérée", async () => {
    const token = await signSession(user);
    expect(await verifySession(token.slice(0, -2))).toBeNull();
    expect(await verifySession(token + "x")).toBeNull();
  });

  it("rejette une session expirée", async () => {
    const token = await signSession(user, -10); // TTL négatif → déjà expirée
    expect(await verifySession(token)).toBeNull();
  });

  it("rejette les entrées invalides", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession(null)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("pas-un-token")).toBeNull();
  });

  it("convertit l'ancien rôle admin en enseignant + admin", async () => {
    const token = await signSession({ ...user, role: "admin" as SessionUser["role"], isAdmin: false });
    const session = await verifySession(token);
    expect(session).toMatchObject({ role: "teacher", isAdmin: true });
  });

  it("conserve l'indicateur admin d'un enseignant", async () => {
    const token = await signSession({ ...user, role: "teacher", isAdmin: true });
    expect(await verifySession(token)).toMatchObject({ role: "teacher", isAdmin: true });
  });

  it("rejette un rôle inconnu même correctement signé", async () => {
    const token = await signSession({ ...user, role: "hacker" as SessionUser["role"] });
    expect(await verifySession(token)).toBeNull();
  });
});
