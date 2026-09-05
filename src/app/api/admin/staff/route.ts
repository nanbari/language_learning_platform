import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { parseStaffUpdate, staffUpdateError, type StaffRow } from "@/lib/staff";

// Client service-role : la RLS est contournée, l'autorisation (droit admin)
// est faite ici même — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

interface UserRow {
  id: string; name: string; email: string; role: string;
  is_admin?: boolean | null; created_at: string;
}

function toStaffRow(u: UserRow): StaffRow {
  return {
    id: u.id, name: u.name, email: u.email, createdAt: u.created_at,
    // L'ancien rôle "admin" vaut enseignant + admin.
    isAdmin: u.role === "admin" || u.is_admin === true,
  };
}

async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!session.isAdmin) return { error: NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 }) };
  return { session };
}

/**
 * GET /api/admin/staff
 * Enseignants (y compris ceux portant encore l'ancien rôle "admin"), avec
 * leur droit admin, par nom. Réservé aux administrateurs.
 * Réponse : StaffRow[]
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase()
    .from("users")
    .select("*")
    .in("role", ["teacher", "admin"])
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data as UserRow[]).map(toStaffRow));
}

/**
 * POST /api/admin/staff  { id, isAdmin }
 * Donne ou retire le droit admin à un enseignant. Un admin ne peut pas se
 * retirer son propre droit. Réservé aux administrateurs.
 *
 * Réponses :
 *  200 { user: StaffRow }
 *  404  enseignant introuvable
 *  409  la cible n'est pas un enseignant, ou retrait de son propre droit
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const body = await req.json().catch(() => null);
  const parsed = parseStaffUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const update = parsed.value;

  const guard = staffUpdateError(update, session.id);
  if (guard) return NextResponse.json({ error: guard }, { status: 409 });

  const db = supabase();
  const { data: target, error: loadError } = await db.from("users").select("*").eq("id", update.id).maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
  if (target.role !== "teacher" && target.role !== "admin") {
    return NextResponse.json({ error: "Seul un enseignant peut recevoir le droit admin" }, { status: 409 });
  }

  // L'ancien rôle "admin" est normalisé en enseignant au passage.
  const { data: updated, error: updateError } = await db
    .from("users")
    .update({ is_admin: update.isAdmin, role: "teacher" })
    .eq("id", update.id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ user: toStaffRow(updated as UserRow) });
}
