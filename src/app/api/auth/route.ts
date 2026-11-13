import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, sessionCookieOptions, signSession, verifySession, type SessionUser } from "@/server/auth";
import { supabase, supabaseAdmin } from "@/server/supabase";
import { currentUser, profileToSession as toSessionUser, type ProfileRow } from "@/server/session";
import { rateLimit } from "@/server/rateLimit";
import { familyProfiles } from "@/server/family";
import { unavailable } from "@/server/errors";
import { parseProfileChoice, type FamilyProfile } from "@/lib/family";

function isProd(): boolean { return process.env.NODE_ENV === "production"; }

/**
 * Vérifie les identifiants auprès de Supabase Auth puis charge le profil
 * (nom, rôle, droits admin) depuis public.users. Retourne null si
 * identifiants invalides. Si le compte existe dans auth.users mais pas
 * encore dans public.users (compte créé via le dashboard), le profil est
 * créé à la volée depuis les user_metadata, avec le rôle "student" par défaut.
 */
async function authenticate(email: string, password: string): Promise<{ user: SessionUser; profiles: FamilyProfile[] } | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profile) {
    const row = profile as ProfileRow;
    // Compte famille : les identifiants du parent ouvrent aussi les profils
    // des frères et sœurs rattachés (vide pour un enseignant ou un admin).
    let family: ProfileRow[] = [];
    try {
      family = await familyProfiles(row);
    } catch (e) {
      // Famille illisible : la personne entre sur son propre profil, sans choix.
      console.error("[auth] profils de la famille illisibles :", e instanceof Error ? e.message : e);
    }
    // Compte désactivé par un admin : mêmes identifiants, mais plus d'accès —
    // sauf aux profils encore actifs de la famille (l'aîné a arrêté, pas le cadet).
    const active = row.disabled_at ? family[0] : row;
    if (!active) return null;
    return { user: toSessionUser(active), profiles: familyChoices(family) };
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
  return { user: fallback, profiles: [] };
}

/** Prénoms proposés à l'écran « Qui est là ? » ; vide s'il n'y a pas de choix à faire. */
function familyChoices(family: ProfileRow[]): FamilyProfile[] {
  return family.length > 1 ? family.map((p) => ({ id: p.id, name: p.name })) : [];
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

  // Compte famille : les autres profils que cette session peut ouvrir.
  let profiles: FamilyProfile[] = [];
  if (profile && user.role === "student") {
    try { profiles = familyChoices(await familyProfiles(profile as ProfileRow)); } catch { /* pas de choix proposé */ }
  }

  const res = NextResponse.json(profiles.length > 0 ? { user, profiles } : { user });
  if (changed) {
    const remember = session.remember === true;
    res.cookies.set(COOKIE_NAME, await signSession(user, { remember }), sessionCookieOptions(remember, isProd()));
  }
  return res;
}

export async function POST(req: NextRequest) {
  let body: { action?: string; email?: string; password?: string; remember?: boolean; id?: string } = {};
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
    const found = await authenticate(email, password);
    if (!found) {
      // Same response shape for unknown email vs bad password — avoids enumeration
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const { user, profiles } = found;
    // Par défaut : session de navigateur (fermée avec le navigateur, 8 h max).
    // « Rester connecté » : cookie persistant 7 jours.
    const remember = body.remember === true;
    const token = await signSession(user, { remember });
    // `profiles` (compte famille) : la page de connexion demande « Qui est là ? ».
    const res = NextResponse.json(profiles.length > 0 ? { user, profiles } : { user });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(remember, isProd()));
    return res;
  }

  // Compte famille : passer au profil d'un frère ou d'une sœur, sans ressaisir
  // le mot de passe. La session courante prouve qui demande ; la cible doit
  // être, en base et maintenant, un profil élève actif de la même famille.
  // La nouvelle session n'est pas prolongée : elle expire quand l'ancienne aurait expiré.
  if (action === "profile") {
    const parsed = parseProfileChoice(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const auth = await currentUser(req);
    if ("error" in auth) return auth.error;
    const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    let family: ProfileRow[];
    try {
      const { data: me, error } = await supabaseAdmin().from("users").select("*").eq("id", auth.user.id).maybeSingle();
      if (error) throw new Error(error.message);
      family = me ? await familyProfiles(me as ProfileRow) : [];
    } catch (e) {
      return unavailable("/api/auth profile", e);
    }
    const target = family.find((p) => p.id === parsed.id);
    // Même réponse que le profil existe ailleurs ou pas du tout.
    if (!target) return NextResponse.json({ error: "Ce profil n'est pas disponible" }, { status: 403 });

    const user = toSessionUser(target);
    const remember = session.remember === true;
    const ttl = Math.max(1, session.exp - Math.floor(Date.now() / 1000));
    const res = NextResponse.json({ user, profiles: familyChoices(family) });
    res.cookies.set(COOKIE_NAME, await signSession(user, { remember, ttl }), sessionCookieOptions(remember, isProd()));
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
