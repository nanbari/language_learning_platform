/**
 * Accès client aux demandes d'inscription (/api/enrollment, /api/admin/enrollments).
 */
import type { EnrollmentAccount, EnrollmentAction, EnrollmentInput, EnrollmentRow } from "@/lib/enrollment";
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

/**
 * Décision de l'admin sur une demande : inscrit, sans suite, ou fin d'inscription.
 * « Inscrit » crée aussi le compte élève (`account`) ; `accountEmail` remplace
 * l'adresse de la demande quand celle-ci est déjà prise (refus 409).
 */
export async function decideEnrollment(id: string, action: EnrollmentAction, accountEmail?: string): Promise<{ request: EnrollmentRow; account?: EnrollmentAccount }> {
  return jsonOrThrow<{ request: EnrollmentRow; account?: EnrollmentAccount }>(await fetch("/api/admin/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(accountEmail ? { id, action, accountEmail } : { id, action }),
  }));
}
