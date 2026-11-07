/**
 * Accès client aux demandes d'inscription (/api/enrollment, /api/admin/enrollments).
 */
import type { EnrollmentAction, EnrollmentInput, EnrollmentRow } from "@/lib/enrollment";
import { jsonOrThrow } from "@/lib/api/client";

/** Envoie la demande d'inscription d'un enfant (formulaire public). `website` : champ piège anti-robots. */
export async function submitEnrollment(input: EnrollmentInput & { website: string }): Promise<void> {
  await jsonOrThrow<{ ok: true }>(await fetch("/api/enrollment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export interface EnrollmentLists {
  /** À traiter. */
  pending: EnrollmentRow[];
  /** Enfants inscrits (coordonnées conservées tant que `ended_at` est vide). */
  enrolled: EnrollmentRow[];
  /** Recontactées sans inscription (effacées automatiquement 6 mois plus tard). */
  closed: EnrollmentRow[];
}

/** Demandes à traiter, enfants inscrits et demandes sans suite (admin). */
export async function fetchEnrollments(): Promise<EnrollmentLists> {
  return jsonOrThrow<EnrollmentLists>(await fetch("/api/admin/enrollments", { cache: "no-store" }));
}

/** Décision de l'admin sur une demande : inscrit, sans suite, ou fin d'inscription. */
export async function decideEnrollment(id: string, action: EnrollmentAction): Promise<EnrollmentRow> {
  const { request } = await jsonOrThrow<{ request: EnrollmentRow }>(await fetch("/api/admin/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action }),
  }));
  return request;
}
