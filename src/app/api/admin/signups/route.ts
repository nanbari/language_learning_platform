import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { parseSignupDecision, type SignupRequestRow } from "@/lib/signup";

// Client service-role : la RLS est contournée, l'autorisation (rôle admin)
// est faite ici même — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

/** Colonnes exposées à l'admin : jamais password_hash. */
const PUBLIC_COLUMNS = "id, email, name, status, created_at, reviewed_at, reviewed_by";
/** Demandes déjà traitées affichées pour l'historique. */
const REVIEWED_LIMIT = 20;

async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!session.isAdmin) return { error: NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 }) };
  return { session };
}

/**
 * GET /api/admin/signups
 * Demandes en attente (les plus anciennes d'abord) et les dernières
 * demandes traitées. Réservé aux administrateurs.
 * Réponse : { pending: SignupRequestRow[], reviewed: SignupRequestRow[] }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const db = supabase();
  const [{ data: pending, error: e1 }, { data: reviewed, error: e2 }] = await Promise.all([
    db.from("signup_requests").select(PUBLIC_COLUMNS).eq("status", "pending").order("created_at", { ascending: true }),
    db.from("signup_requests").select(PUBLIC_COLUMNS).neq("status", "pending").order("reviewed_at", { ascending: false }).limit(REVIEWED_LIMIT),
  ]);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({
    pending: (pending ?? []) as SignupRequestRow[],
    reviewed: (reviewed ?? []) as SignupRequestRow[],
  });
}

/**
 * POST /api/admin/signups  { id, action: "approve" | "reject" }
 * Approuve (crée le compte Supabase Auth + le profil élève) ou refuse une
 * demande en attente. Dans les deux cas le hachage du mot de passe est
 * effacé de la demande. Réservé aux administrateurs.
 *
 * Réponses :
 *  200 { request }   demande mise à jour
 *  404               demande introuvable
 *  409               demande déjà traitée, ou e-mail déjà utilisé côté Auth
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const body = await req.json().catch(() => null);
  const parsed = parseSignupDecision(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id, action } = parsed;

  const db = supabase();

  const { data: request, error: loadError } = await db
    .from("signup_requests")
    .select("id, email, name, status, password_hash")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!request) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Cette demande a déjà été traitée" }, { status: 409 });
  }

  if (action === "approve") {
    if (!request.password_hash) {
      return NextResponse.json({ error: "Demande sans mot de passe : refusez-la et demandez une nouvelle inscription" }, { status: 409 });
    }

    // Création du compte Auth avec le hachage bcrypt fourni à l'inscription.
    // email_confirm : pas d'e-mail de confirmation, l'admin a validé.
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: request.email,
      password_hash: request.password_hash,
      email_confirm: true,
      user_metadata: { name: request.name, role: "student" },
    });
    if (createError || !created.user) {
      const status = createError?.status === 422 ? 409 : 500;
      const message = status === 409
        ? "Un compte Supabase existe déjà avec cette adresse e-mail"
        : (createError?.message ?? "Création du compte impossible");
      return NextResponse.json({ error: message }, { status });
    }

    const { error: profileError } = await db.from("users").insert({
      id: created.user.id,
      email: request.email,
      name: request.name,
      role: "student",
    });
    if (profileError) {
      // Ne pas laisser un compte Auth orphelin : l'admin pourra réessayer.
      await db.auth.admin.deleteUser(created.user.id).catch(() => {});
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await db
    .from("signup_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      password_hash: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.id,
    })
    .eq("id", id)
    .select(PUBLIC_COLUMNS)
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ request: updated as SignupRequestRow });
}
