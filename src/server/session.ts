import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession, type SessionUser } from "@/server/auth";
import { supabaseAdmin } from "@/server/supabase";
import { unavailable } from "@/server/errors";

/**
 * Identité courante d'une requête API.
 *
 * Le cookie signé (lib/auth) prouve *qui* fait la requête ; ses autres
 * champs (rôle, droit admin, nom) ne sont qu'un instantané de la connexion,
 * valable jusqu'à sept jours. Ici, le profil est relu dans public.users à
 * chaque requête protégée : un droit retiré, un compte désactivé ou supprimé
 * prennent effet à la requête suivante, sans attendre l'expiration du
 * cookie. Une lecture par requête, par clé primaire : négligeable à l'échelle
 * de l'association.
 *
 * Si le profil ne peut pas être lu, on refuse (503) plutôt que de se rabattre
 * sur le cookie : l'autorisation n'est jamais devinée.
 */

export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  role: string;
  /** Absent tant que la migration is_admin n'a pas été appliquée. */
  is_admin?: boolean | null;
  /** Compte désactivé par un admin (migration 2026-10-28) : plus aucun accès. */
  disabled_at?: string | null;
}

/** Convertit une ligne de public.users en session. L'ancien rôle "admin" vaut enseignant + admin. */
export function profileToSession(p: ProfileRow): SessionUser {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    role: p.role === "student" ? "student" : "teacher",
    isAdmin: p.role === "admin" || p.is_admin === true,
  };
}

export type Authenticated = { user: SessionUser } | { error: NextResponse };

/** Réponse de refus qui efface aussi le cookie : le navigateur repart de la page de connexion. */
function signedOut(message: string, status: 401 | 403): NextResponse {
  const res = NextResponse.json({ error: message }, { status });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/**
 * L'utilisateur connecté, tel que la base le connaît maintenant ; sinon la
 * réponse d'erreur à renvoyer telle quelle.
 */
export async function currentUser(req: NextRequest): Promise<Authenticated> {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };

  let profile: ProfileRow | null;
  try {
    const { data, error } = await supabaseAdmin().from("users").select("*").eq("id", session.id).maybeSingle();
    if (error) return { error: unavailable("session: lecture du profil", error) };
    profile = (data as ProfileRow | null) ?? null;
  } catch (e) {
    return { error: unavailable("session: lecture du profil", e) };
  }

  if (!profile) return { error: signedOut("Session expirée", 401) };
  if (profile.disabled_at) return { error: signedOut("Compte désactivé", 403) };
  return { user: profileToSession(profile) };
}

/** Enseignants et admins. */
export async function requireStaff(req: NextRequest): Promise<Authenticated> {
  const auth = await currentUser(req);
  if ("error" in auth) return auth;
  if (auth.user.role !== "teacher" && !auth.user.isAdmin) {
    return { error: NextResponse.json({ error: "Réservé aux enseignants" }, { status: 403 }) };
  }
  return auth;
}

/** Admins seulement. */
export async function requireAdmin(req: NextRequest): Promise<Authenticated> {
  const auth = await currentUser(req);
  if ("error" in auth) return auth;
  if (!auth.user.isAdmin) return { error: NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 }) };
  return auth;
}
