import { NextResponse } from "next/server";

/**
 * Réponses d'erreur des routes API quand le serveur ou la base échoue.
 *
 * Le détail (message Supabase, nom de table, contrainte…) reste dans les
 * journaux du serveur, avec une référence courte que le client reçoit à la
 * place : un utilisateur peut la citer au support sans qu'elle révèle quoi
 * que ce soit de l'intérieur. Les erreurs de validation (400), de droits
 * (401/403/404) et de conflit (409) gardent leurs messages, eux utiles.
 */

/** Référence lisible, assez courte pour être recopiée. */
export function errorRef(): string {
  return Math.random().toString(36).slice(2, 8);
}

function describe(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause) return String((cause as { message: unknown }).message);
  return String(cause);
}

function log(ref: string, context: string, cause: unknown) {
  // Jamais de jeton, de cookie ni de corps de requête ici : seulement le
  // point d'échec et le message du fournisseur.
  console.error(`[api ${ref}] ${context}: ${describe(cause)}`);
}

/** Erreur Postgres « colonne inexistante » (42703) : une migration n'est pas encore passée. */
export function isMissingColumn(cause: unknown): boolean {
  const c = cause as { code?: string; message?: string } | null;
  return c?.code === "42703" || /column .* does not exist/i.test(c?.message ?? "");
}

const warnedOnce = new Set<string>();
/** Avertissement émis une seule fois par processus (migration manquante, service absent…). */
export function warnOnce(message: string) {
  if (warnedOnce.has(message)) return;
  warnedOnce.add(message);
  console.warn(`[api] ${message}`);
}

/** 500 : la base ou un service a échoué pendant une opération autorisée. */
export function serverError(context: string, cause: unknown): NextResponse {
  const ref = errorRef();
  log(ref, context, cause);
  return NextResponse.json({ error: "Erreur serveur", ref }, { status: 500 });
}

/**
 * 503 : l'autorisation n'a pas pu être établie (profil illisible, service
 * indisponible). On refuse plutôt que de laisser passer ; le client peut
 * réessayer.
 */
export function unavailable(context: string, cause: unknown): NextResponse {
  const ref = errorRef();
  log(ref, context, cause);
  return NextResponse.json({ error: "Service indisponible, réessayez dans un instant", ref }, { status: 503 });
}
