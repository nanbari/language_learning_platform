import { describe, it, expect } from "vitest";
import { parseResetRequest, parseNewPassword, readRecoveryHash } from "./passwordReset";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.payload.signature";

describe("parseResetRequest", () => {
  it("normalise l'email et refuse une adresse invalide", () => {
    expect(parseResetRequest({ email: "  Anna@Exemple.BE " })).toEqual({ ok: true, value: { email: "anna@exemple.be" } });
    expect(parseResetRequest({ email: "pas-un-email" }).ok).toBe(false);
    expect(parseResetRequest({}).ok).toBe(false);
    expect(parseResetRequest(null).ok).toBe(false);
  });
});

describe("parseNewPassword", () => {
  it("exige un jeton et un mot de passe de 8 à 128 caractères", () => {
    expect(parseNewPassword({ accessToken: TOKEN, password: "abcdefgh" })).toEqual({ ok: true, value: { accessToken: TOKEN, password: "abcdefgh" } });
    expect(parseNewPassword({ accessToken: TOKEN, password: "court" })).toMatchObject({ ok: false, error: expect.stringContaining("au moins 8") });
    expect(parseNewPassword({ accessToken: TOKEN, password: "x".repeat(129) }).ok).toBe(false);
    expect(parseNewPassword({ accessToken: "", password: "abcdefgh" })).toMatchObject({ ok: false, error: expect.stringContaining("Lien") });
    expect(parseNewPassword(undefined).ok).toBe(false);
  });
});

describe("readRecoveryHash", () => {
  it("extrait le jeton d'un lien de récupération", () => {
    expect(readRecoveryHash(`#access_token=${TOKEN}&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery`))
      .toEqual({ kind: "token", accessToken: TOKEN, invite: false });
    expect(readRecoveryHash(`#access_token=${TOKEN}&type=invite`)).toEqual({ kind: "token", accessToken: TOKEN, invite: true });
  });

  it("signale un lien expiré ou invalide", () => {
    expect(readRecoveryHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"))
      .toMatchObject({ kind: "error", message: expect.stringContaining("expiré") });
    expect(readRecoveryHash("#error=server_error")).toMatchObject({ kind: "error", message: expect.stringContaining("pas valide") });
  });

  it("ignore un fragment vide ou un jeton qui n'est pas de récupération", () => {
    expect(readRecoveryHash("")).toEqual({ kind: "none" });
    expect(readRecoveryHash(`#access_token=${TOKEN}&type=signup`)).toEqual({ kind: "none" });
  });
});
