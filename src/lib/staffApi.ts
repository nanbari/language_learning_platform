/**
 * Accès client à la gestion des enseignants (/api/admin/staff, admin).
 */
import type { StaffRow } from "./staff";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  return data as T;
}

/** Enseignants et leur droit admin. */
export async function fetchStaff(): Promise<StaffRow[]> {
  return jsonOrThrow<StaffRow[]>(await fetch("/api/admin/staff"));
}

/** Résultat de la création : invitation partie par e-mail, ou lien à transmettre soi-même. */
export type CreatedTeacher =
  | { user: StaffRow; emailSent: true }
  | { user: StaffRow; emailSent: false; inviteLink: string; emailError: string | null };

/** Crée un compte enseignant ; l'enseignant choisira son mot de passe via l'invitation. */
export async function createTeacher(input: { name: string; email: string; isAdmin: boolean }): Promise<CreatedTeacher> {
  return jsonOrThrow<CreatedTeacher>(await fetch("/api/admin/teachers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

/** Donne ou retire le droit admin à un enseignant. */
export async function setStaffAdmin(id: string, isAdmin: boolean): Promise<StaffRow> {
  const { user } = await jsonOrThrow<{ user: StaffRow }>(await fetch("/api/admin/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, isAdmin }),
  }));
  return user;
}
