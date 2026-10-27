import { describe, it, expect } from "vitest";
import { LIVE_TOKEN_TTL_SECONDS, liveTopics } from "@/lib/liveSession";
import { mintLiveToken, verifyLiveToken } from "@/server/liveToken";

const SECRET = "jwt-secret-for-tests-0123456789";
const ROOM = "11111111-1111-4111-8111-111111111111";

describe("mintLiveToken", () => {
  it("n'émet rien sans secret (ou avec un secret trop court)", () => {
    expect(mintLiveToken({ userId: "u", room: ROOM, role: "student" }, undefined)).toBeNull();
    expect(mintLiveToken({ userId: "u", room: ROOM, role: "student" }, "court")).toBeNull();
  });

  it("émet un JWT HS256 lié à la personne, au salon et au rôle, valable 15 minutes", () => {
    const now = 1_800_000_000_000;
    const minted = mintLiveToken({ userId: "user-1", room: ROOM, role: "teacher" }, SECRET, now)!;
    const claims = verifyLiveToken(minted.token, SECRET, now)!;
    expect(claims).toMatchObject({ sub: "user-1", ms_room: ROOM, ms_role: "teacher", role: "authenticated", aud: "authenticated" });
    expect(claims.exp - claims.iat).toBe(LIVE_TOKEN_TTL_SECONDS);
    expect(minted.expiresAt).toBe(claims.exp * 1000);
    const header = JSON.parse(Buffer.from(minted.token.split(".")[0], "base64url").toString());
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("est refusé avec un autre secret, une signature altérée ou après expiration", () => {
    const now = 1_800_000_000_000;
    const { token } = mintLiveToken({ userId: "user-1", room: ROOM, role: "student" }, SECRET, now)!;
    expect(verifyLiveToken(token, "another-secret-0123456789abc", now)).toBeNull();
    expect(verifyLiveToken(token.slice(0, -3) + "AAA", SECRET, now)).toBeNull();
    expect(verifyLiveToken(token, SECRET, now + (LIVE_TOKEN_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it("nomme les sujets de la séance", () => {
    expect(liveTopics(ROOM)).toEqual({ control: `live:${ROOM}:control`, video: `live:${ROOM}:video` });
  });
});
