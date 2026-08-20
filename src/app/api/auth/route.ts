import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_TTL_SECONDS, signSession, verifySession, type SessionUser } from "@/lib/auth";
import { supabase, supabaseAdmin } from "@/lib/supabase";

function isProd(): boolean { return process.env.NODE_ENV === "production"; }

/**
 * Vérifie les identifiants auprès de Supabase Auth puis charge le profil
 * (nom, rôle) depuis public.users. Retourne null si identifiants invalides.
 * Si le compte existe dans auth.users mais pas encore dans public.users
 * (compte créé via le dashboard), le profil est créé à la volée depuis les
 * user_metadata, avec le rôle "student" par défaut.
 */
async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, name, role")
    .eq("id", data.user.id)
    .single();

  if (profile) return profile as SessionUser;

  const meta = (data.user.user_metadata ?? {}) as { name?: string; role?: string };
  const role = meta.role === "teacher" || meta.role === "admin" ? meta.role : "student";
  const fallback: SessionUser = {
    id: data.user.id,
    email: data.user.email ?? email,
    name: meta.name ?? email.split("@")[0],
    role,
  };
  const { error: insertError } = await admin.from("users").insert(fallback);
  if (insertError) return null;
  return fallback;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: { id: session.id, email: session.email, name: session.name, role: session.role },
  });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; email?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* tolerate empty body */ }
  const action = body.action ?? "login";

  if (action === "login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const user = await authenticate(email, password);
    if (!user) {
      // Same response shape for unknown email vs bad password — avoids enumeration
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const token = await signSession(user);
    const res = NextResponse.json({ user });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
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
