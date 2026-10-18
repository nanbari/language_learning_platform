import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { parseEnrollmentHandled, type EnrollmentRow } from "@/lib/enrollment";

// Client service-role : la RLS est contournée, l'autorisation (rôle admin)
// est faite ici même — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

const COLUMNS = "id, parent_name, email, phone, child_name, child_age, level, status, created_at, handled_at";

async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!session.isAdmin) return { error: NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 }) };
  return { session };
}

/**
 * GET /api/admin/enrollments
 * Demandes d'inscription à traiter, les plus anciennes d'abord.
 * Réservé aux administrateurs. Réponse : { pending: EnrollmentRow[] }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase()
    .from("enrollment_requests")
    .select(COLUMNS)
    .eq("status", "new")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pending: (data ?? []) as EnrollmentRow[] });
}

/**
 * POST /api/admin/enrollments  { id }
 * Marque une demande comme traitée (famille recontactée). Réservé aux
 * administrateurs.
 *
 * Réponses :
 *  200 { request }   demande mise à jour
 *  404               demande introuvable ou déjà traitée
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = parseEnrollmentHandled(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase()
    .from("enrollment_requests")
    .update({ status: "handled", handled_at: new Date().toISOString(), handled_by: auth.session.id })
    .eq("id", parsed.id)
    .eq("status", "new")
    .select(COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Demande introuvable ou déjà traitée" }, { status: 404 });

  return NextResponse.json({ request: data as EnrollmentRow });
}
