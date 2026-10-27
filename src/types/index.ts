export type UserRole = "teacher" | "student";

/** Utilisateur connecté, tel que /api/auth le renvoie et que le store le garde. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Droits d'administration, cumulables avec le rôle (enseignant admin). */
  isAdmin?: boolean;
}
