/**
 * Mot de passe oublié — modèle partagé client / serveur.
 *
 * 1. /mot-de-passe-oublie : la personne saisit son email ; le serveur demande
 *    à Supabase Auth d'envoyer le lien de réinitialisation. La réponse est
 *    toujours la même, que le compte existe ou non (pas d'énumération).
 * 2. Le lien ramène sur /reinitialiser-mot-de-passe avec, dans le fragment
 *    d'URL (#access_token=…&type=recovery), un jeton de récupération.
 * 3. La page envoie ce jeton et le nouveau mot de passe au serveur, qui
 *    vérifie le jeton auprès de Supabase puis change le mot de passe.
 *
 * Module pur (validation, lecture du fragment), testé à part.
 */
import { MAX_EMAIL, MAX_PASSWORD, MIN_PASSWORD } from "./signup";

export const RESET_PAGE_PATH = "/reinitialiser-mot-de-passe";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseResetRequest(input: unknown): Parsed<{ email: string }> {
  const email = typeof (input as { email?: unknown })?.email === "string"
    ? (input as { email: string }).email.trim().toLowerCase()
    : "";
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Adresse email invalide" };
  }
  return { ok: true, value: { email } };
}

export function parseNewPassword(input: unknown): Parsed<{ accessToken: string; password: string }> {
  const { accessToken, password } = (input ?? {}) as Record<string, unknown>;
  if (typeof accessToken !== "string" || accessToken.length < 20) {
    return { ok: false, error: "Lien de réinitialisation invalide. Demandez-en un nouveau." };
  }
  if (typeof password !== "string") return { ok: false, error: "Le mot de passe est requis" };
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères` };
  if (password.length > MAX_PASSWORD) return { ok: false, error: `Le mot de passe doit faire au plus ${MAX_PASSWORD} caractères` };
  return { ok: true, value: { accessToken, password } };
}

/**
 * Lit le fragment ajouté par Supabase au lien de l'email :
 *  - succès : #access_token=…&type=recovery&… (ou type=invite pour une invitation)
 *  - lien expiré ou déjà utilisé : #error=access_denied&error_code=otp_expired&…
 */
export function readRecoveryHash(hash: string):
  | { kind: "token"; accessToken: string; invite: boolean }
  | { kind: "error"; message: string }
  | { kind: "none" } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("error") || params.get("error_code")) {
    const expired = params.get("error_code") === "otp_expired";
    return {
      kind: "error",
      message: expired
        ? "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau."
        : "Ce lien de réinitialisation n'est pas valide. Demandez-en un nouveau.",
    };
  }
  const accessToken = params.get("access_token");
  const type = params.get("type");
  // « invite » : lien d'invitation d'un enseignant créé par un admin, qui choisit ici son premier mot de passe.
  if (accessToken && (type === "recovery" || type === "invite")) return { kind: "token", accessToken, invite: type === "invite" };
  return { kind: "none" };
}
