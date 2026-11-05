/**
 * Accès client aux demandes d'inscription (/api/enrollment, /api/admin/enrollments).
 */
import type { EnrollmentInput, EnrollmentRow } from "@/lib/enrollment";
import { jsonOrThrow } from "@/lib/api/client";

/** Envoie la demande d'inscription d'un enfant (formulaire public). `website` : champ piège anti-robots. */
export async function submitEnrollment(input: EnrollmentInput & { website: string }): Promise<void> {
  await jsonOrThrow<{ ok: true }>(await fetch("/api/enrollment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

/** Demandes à traiter et demandes déjà traitées (admin). */
export async function fetchEnrollments(): Promise<{ pending: EnrollmentRow[]; handled: EnrollmentRow[] }> {
  return jsonOrThrow<{ pending: EnrollmentRow[]; handled: EnrollmentRow[] }>(await fetch("/api/admin/enrollments", { cache: "no-store" }));
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
