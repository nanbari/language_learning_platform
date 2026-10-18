/**
 * Accès client aux demandes d'inscription (/api/enrollment, /api/admin/enrollments).
 */
import type { EnrollmentInput, EnrollmentRow } from "./enrollment";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  return data as T;
}

/** Envoie la demande d'inscription d'un enfant (formulaire public). `website` : champ piège anti-robots. */
export async function submitEnrollment(input: EnrollmentInput & { website: string }): Promise<void> {
  await jsonOrThrow<{ ok: true }>(await fetch("/api/enrollment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

/** Demandes à traiter (admin). */
export async function fetchEnrollments(): Promise<EnrollmentRow[]> {
  const { pending } = await jsonOrThrow<{ pending: EnrollmentRow[] }>(await fetch("/api/admin/enrollments", { cache: "no-store" }));
  return pending;
}

/** Marque une demande comme traitée (admin). */
export async function markEnrollmentHandled(id: string): Promise<EnrollmentRow> {
  const { request } = await jsonOrThrow<{ request: EnrollmentRow }>(await fetch("/api/admin/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }));
  return request;
}
