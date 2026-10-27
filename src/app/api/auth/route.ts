import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, sessionCookieOptions, signSession, verifySession, type SessionUser } from "@/server/auth";
import { supabase, supabaseAdmin } from "@/server/supabase";
import { profileToSession as toSessionUser, type ProfileRow } from "@/server/session";
import { rateLimit } from "@/server/rateLimit";

function isProd(): boolean { return process.env.NODE_ENV === "production"; }

/**
 * Vérifie les identifiants auprès de Supabase Auth puis charge le profil
 * (nom, rôle, droits admin) depuis public.users. Retourne null si
 * identifiants invalides. Si le compte existe dans auth.users mais pas
 * encore dans public.users (compte créé via le dashboard), le profil est
 * créé à la volée depuis les user_metadata, avec le rôle "student" par défaut.
 */
async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profile) {
    // Compte désactivé par un admin : mêmes identifiants, mais plus d'accès.
    if ((profile as ProfileRow).disabled_at) return null;
    return toSessionUser(profile as ProfileRow);
  }

  const meta = (data.user.user_metadata ?? {}) as { name?: string; role?: string };
  const role = meta.role === "teacher" || meta.role === "admin" ? "teacher" : "student";
  const fallback: SessionUser = {
    id: data.user.id,
    email: data.user.email ?? email,
    name: meta.name ?? email.split("@")[0],
    role,
    isAdmin: meta.role === "admin",
  };
  const { error: insertError } = await admin
    .from("users")
    .insert({ id: fallback.id, email: fallback.email, name: fallback.name, role: fallback.role });
  if (insertError) return null;
  return fallback;
}

/**
 * GET /api/auth
 * Session courante. Le profil (nom, rôle, droit admin) est relu en base à
 * chaque appel : un droit admin donné entre-temps s'applique au prochain
 * chargement de page, sans reconnexion. Le cookie est réémis s'il a changé.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  let user: SessionUser = { id: session.id, email: session.email, name: session.name, role: session.role, isAdmin: session.isAdmin };
  const { data: profile, error } = await supabaseAdmin().from("users").select("*").eq("id", session.id).maybeSingle();
  // Profil disparu ou compte désactivé : la session est close, cookie effacé.
  // (Une erreur de lecture ne ferme rien : la session reste telle quelle et
  // les routes de données, qui relisent le profil, refuseront d'elles-mêmes.)
  if (!error && (!profile || (profile as ProfileRow).disabled_at)) {
    const res = NextResponse.json({ user: null });
    res.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  }
  const fresh = profile ? toSessionUser(profile as ProfileRow) : null;

  const changed = fresh && (fresh.isAdmin !== user.isAdmin || fresh.role !== user.role || fresh.name !== user.name);
  if (fresh && changed) user = fresh;

  const res = NextResponse.json({ user });
  if (changed) {
    const remember = session.remember === true;
    res.cookies.set(COOKIE_NAME, await signSession(user, { remember }), sessionCookieOptions(remember, isProd()));
  }
  return res;
}

export async function POST(req: NextRequest) {
  let body: { action?: string; email?: string; password?: string; remember?: boolean } = {};
  try { body = await req.json(); } catch { /* tolerate empty body */ }
  const action = body.action ?? "login";

  if (action === "login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const limited = await rateLimit(req, "login", email);
    if (limited) return limited;
    const user = await authenticate(email, password);
    if (!user) {
      // Same response shape for unknown email vs bad password — avoids enumeration
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    // Par défaut : session de navigateur (fermée avec le navigateur, 8 h max).
    // « Rester connecté » : cookie persistant 7 jours.
    const remember = body.remember === true;
    const token = await signSession(user, { remember });
    const res = NextResponse.json({ user });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(remember, isProd()));
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: isProd(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
