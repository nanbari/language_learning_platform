import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { parseStaffUpdate, staffUpdateError, type StaffRow } from "@/lib/staff";
import { requireAdmin } from "@/server/session";
import { serverError } from "@/server/errors";

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

/**
 * GET /api/admin/staff
 * Enseignants (y compris ceux portant encore l'ancien rôle "admin"), avec
 * leur droit admin, par nom. Réservé aux administrateurs.
 * Réponse : StaffRow[]
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabaseAdmin()
    .from("users")
    .select("*")
    .in("role", ["teacher", "admin"])
    .order("name", { ascending: true });
  if (error) return serverError("/api/admin/staff error", error);

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
  const session = auth.user;

  const body = await req.json().catch(() => null);
  const parsed = parseStaffUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const update = parsed.value;

  const guard = staffUpdateError(update, session.id);
  if (guard) return NextResponse.json({ error: guard }, { status: 409 });

  const db = supabaseAdmin();
  const { data: target, error: loadError } = await db.from("users").select("*").eq("id", update.id).maybeSingle();
  if (loadError) return serverError("/api/admin/staff loadError", loadError);
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
  if (updateError) return serverError("/api/admin/staff updateError", updateError);

  return NextResponse.json({ user: toStaffRow(updated as UserRow) });
}
