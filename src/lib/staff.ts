/**
 * Gestion des enseignants par un admin — modèle partagé client / serveur.
 *
 * Un admin voit la liste des enseignants et peut donner ou retirer le droit
 * admin (colonne users.is_admin, cumulable avec le rôle enseignant). Il ne
 * peut pas se retirer son propre droit : il resterait sinon sans admin.
 * Il peut aussi créer un compte enseignant : il obtient un lien d'invitation
 * à transmettre, et l'enseignant y choisit lui-même son mot de passe.
 */
import { MAX_EMAIL, MAX_NAME, MIN_NAME, normaliseEmail } from "./signup";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface StaffUpdate {
  id: string;
  isAdmin: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valide le corps d'une modification de droit admin. */
export function parseStaffUpdate(input: unknown): { ok: true; value: StaffUpdate } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "corps invalide" };
  const { id, isAdmin } = input as Record<string, unknown>;
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "id invalide" };
  if (typeof isAdmin !== "boolean") return { ok: false, error: "isAdmin doit être un booléen" };
  return { ok: true, value: { id, isAdmin } };
}

export interface NewTeacher {
  name: string;
  email: string;
  isAdmin: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valide le formulaire « Créer un enseignant » : nom et e-mail (mêmes règles
 * que l'inscription élève), plus le droit admin. Pas de mot de passe : c'est
 * l'enseignant qui le choisit en ouvrant son lien d'invitation.
 */
export function parseNewTeacher(input: unknown): { ok: true; value: NewTeacher } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "formulaire invalide" };
  const { name, email, isAdmin } = input as Record<string, unknown>;

  if (typeof name !== "string") return { ok: false, error: "Le nom est requis" };
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < MIN_NAME) return { ok: false, error: `Le nom doit faire au moins ${MIN_NAME} caractères` };
  if (cleanName.length > MAX_NAME) return { ok: false, error: `Le nom doit faire au plus ${MAX_NAME} caractères` };

  if (typeof email !== "string") return { ok: false, error: "L'adresse e-mail est requise" };
  const cleanEmail = normaliseEmail(email);
  if (cleanEmail.length > MAX_EMAIL || !EMAIL_RE.test(cleanEmail)) return { ok: false, error: "Adresse e-mail invalide" };

  if (isAdmin !== undefined && typeof isAdmin !== "boolean") return { ok: false, error: "isAdmin doit être un booléen" };
  return { ok: true, value: { name: cleanName, email: cleanEmail, isAdmin: isAdmin === true } };
}

/**
 * Vérifie qu'une modification est permise : on ne retire pas son propre
 * droit admin. Rend un message d'erreur, ou null si tout va bien.
 */
export function staffUpdateError(update: StaffUpdate, actorId: string): string | null {
  if (update.id === actorId && !update.isAdmin) {
    return "Vous ne pouvez pas retirer votre propre droit admin";
  }
  return null;
}
