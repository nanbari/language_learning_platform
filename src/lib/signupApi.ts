/**
 * Accès client aux demandes de compte élève (/api/signup, /api/admin/signups).
 */
import type { SignupAction, SignupInput, SignupRequestRow } from "./signup";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  return data as T;
}

/** Envoie une demande de compte élève (formulaire public). */
export async function submitSignup(input: SignupInput): Promise<void> {
  await jsonOrThrow<{ ok: true }>(await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export interface SignupRequests {
  pending: SignupRequestRow[];
  reviewed: SignupRequestRow[];
}

/** Demandes en attente et récemment traitées (admin). */
export async function fetchSignupRequests(): Promise<SignupRequests> {
  return jsonOrThrow<SignupRequests>(await fetch("/api/admin/signups"));
}

/** Approuve ou refuse une demande (admin). */
export async function reviewSignupRequest(id: string, action: SignupAction): Promise<SignupRequestRow> {
  const { request } = await jsonOrThrow<{ request: SignupRequestRow }>(await fetch("/api/admin/signups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action }),
  }));
  return request;
}
