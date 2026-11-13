/**
 * Règles communes aux comptes (élèves, enseignants) — partagées client / serveur.
 *
 * Bornes du nom, de l'adresse e-mail et du mot de passe, et normalisation de
 * l'adresse. Utilisées par l'inscription (src/lib/enrollment.ts), l'équipe
 * (src/lib/staff.ts) et le choix du mot de passe (src/lib/passwordReset.ts).
 *
 * Un compte élève n'est créé que par un admin, quand il marque une demande
 * d'inscription « inscrit » (/api/admin/enrollments) : il n'existe pas de
 * formulaire public de création de compte.
 */

export const MIN_NAME = 2;
export const MAX_NAME = 80;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const MAX_EMAIL = 254;

/** Normalise une adresse e-mail (espaces, casse). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
