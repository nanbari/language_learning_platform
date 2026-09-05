/**
 * Demandes de création de compte élève — modèle partagé client / serveur.
 *
 * Un visiteur remplit le formulaire public (/inscription). Aucun compte
 * n'est créé à ce moment : la demande est stockée dans `signup_requests`
 * avec le mot de passe haché (bcrypt). Un administrateur l'approuve ou la
 * refuse depuis son tableau de bord ; à l'approbation seulement, le compte
 * Supabase Auth et le profil `users` sont créés, avec le hachage fourni.
 *
 * Ce module est pur (validation, types) et testé à part ; le hachage et
 * l'accès base sont dans les routes serveur.
 */

export const SIGNUP_STATUSES = ["pending", "approved", "rejected"] as const;
export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

export const SIGNUP_ACTIONS = ["approve", "reject"] as const;
export type SignupAction = (typeof SIGNUP_ACTIONS)[number];

export const MIN_NAME = 2;
export const MAX_NAME = 80;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const MAX_EMAIL = 254;

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

/** Ligne de `signup_requests` telle qu'exposée à l'admin (jamais le hachage). */
export interface SignupRequestRow {
  id: string;
  email: string;
  name: string;
  status: SignupStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

type ParseResult = { ok: true; value: SignupInput } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalise une adresse e-mail (espaces, casse). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Valide et normalise le formulaire d'inscription. */
export function parseSignupInput(input: unknown): ParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "formulaire invalide" };
  }
  const { name, email, password } = input as Record<string, unknown>;

  if (typeof name !== "string") return { ok: false, error: "Le nom est requis" };
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < MIN_NAME) return { ok: false, error: `Le nom doit faire au moins ${MIN_NAME} caractères` };
  if (cleanName.length > MAX_NAME) return { ok: false, error: `Le nom doit faire au plus ${MAX_NAME} caractères` };

  if (typeof email !== "string") return { ok: false, error: "L'adresse e-mail est requise" };
  const cleanEmail = normaliseEmail(email);
  if (cleanEmail.length > MAX_EMAIL || !EMAIL_RE.test(cleanEmail)) return { ok: false, error: "Adresse e-mail invalide" };

  if (typeof password !== "string") return { ok: false, error: "Le mot de passe est requis" };
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères` };
  if (password.length > MAX_PASSWORD) return { ok: false, error: `Le mot de passe doit faire au plus ${MAX_PASSWORD} caractères` };

  return { ok: true, value: { name: cleanName, email: cleanEmail, password } };
}

/** Valide le corps d'une décision admin. */
export function parseSignupDecision(input: unknown): { ok: true; id: string; action: SignupAction } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "corps invalide" };
  const { id, action } = input as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "id invalide" };
  if (!SIGNUP_ACTIONS.includes(action as SignupAction)) return { ok: false, error: "action invalide" };
  return { ok: true, id, action: action as SignupAction };
}
