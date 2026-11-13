/**
 * Compte famille — modèle partagé client / serveur.
 *
 * Un parent inscrit souvent plusieurs enfants avec sa seule adresse e-mail,
 * et un enfant de six ans n'a pas d'adresse à lui. Le premier enfant inscrit
 * porte le compte de la famille : l'adresse du parent et le mot de passe.
 * Ses frères et sœurs ont chacun leur profil élève (leçons, classe et
 * progression séparées), rattaché à ce compte par `users.family_account_id`,
 * sans mot de passe propre. À la connexion avec l'adresse du parent, la
 * famille choisit le prénom (« Qui est là ? ») ; elle peut en changer ensuite
 * sans ressaisir le mot de passe.
 *
 * Supabase Auth exige une adresse unique par compte : un profil rattaché
 * reçoit une adresse technique (FAMILY_ALIAS_DOMAIN) à laquelle rien n'est
 * jamais envoyé et qui ne sert pas à se connecter.
 */

/** Domaine des adresses techniques des profils rattachés ; aucune boîte n'existe derrière. */
export const FAMILY_ALIAS_DOMAIN = "famille.monteetsouris.com";

/** Adresse technique d'un profil rattaché (`key` : identifiant aléatoire). */
export function familyAliasEmail(key: string): string {
  return `eleve-${key}@${FAMILY_ALIAS_DOMAIN}`;
}

/** Adresse technique (à ne pas afficher comme une adresse de contact) ? */
export function isFamilyAlias(email: string): boolean {
  return email.toLowerCase().endsWith(`@${FAMILY_ALIAS_DOMAIN}`);
}

/** Un profil élève de la famille, tel que proposé à l'écran « Qui est là ? ». */
export interface FamilyProfile {
  id: string;
  name: string;
}

/** Valide { id } du changement de profil. */
export function parseProfileChoice(input: unknown): { ok: true; id: string } | { ok: false; error: string } {
  const id = (input as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "profil invalide" };
  return { ok: true, id };
}
