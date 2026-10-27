/**
 * Appels des routes /api depuis le navigateur : une seule façon de lire la
 * réponse et de signaler un refus.
 *
 * Toute route répond en JSON ; en cas d'erreur, `{ error: string }` (et
 * `ref` pour une panne serveur). Le message est destiné à l'utilisateur,
 * en français ; le statut HTTP reste disponible pour distinguer « refusé »
 * (401/403/404) de « injoignable » (réseau, 5xx).
 */

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly ref?: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Lit une réponse JSON ; lève ApiError si le serveur a refusé. */
export async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const body = data as { error?: string; ref?: string } | null;
    throw new ApiError(res.status, body?.error ?? `Erreur serveur (${res.status})`, body?.ref);
  }
  return data as T;
}

/** fetch + jsonOrThrow, sans cache : les données privées ne sont jamais réutilisées entre deux comptes. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  return jsonOrThrow<T>(await fetch(url, { cache: "no-store", ...init }));
}
