/**
 * Gestion des enseignants par un admin — modèle partagé client / serveur.
 *
 * Un admin voit la liste des enseignants et peut donner ou retirer le droit
 * admin (colonne users.is_admin, cumulable avec le rôle enseignant). Il ne
 * peut pas se retirer son propre droit : il resterait sinon sans admin.
 */

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
