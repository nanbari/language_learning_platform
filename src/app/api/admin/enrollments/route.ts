import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { parseEnrollmentHandled, type EnrollmentRow } from "@/lib/enrollment";
import { requireAdmin } from "@/server/session";
import { serverError } from "@/server/errors";

const COLUMNS = "id, parent_name, email, phone, child_name, child_age, level, letters, known_letters, letter_forms, known_letter_forms, vocabulary, vocabulary_domains, vocabulary_other, status, created_at, handled_at";

/** Demandes traitées renvoyées (les plus récentes) : l'historique reste consultable sans alourdir la page. */
const HANDLED_LIMIT = 300;

/**
 * GET /api/admin/enrollments
 * Demandes d'inscription à traiter (les plus anciennes d'abord) et demandes
 * déjà traitées (les plus récentes d'abord, HANDLED_LIMIT au plus) : rien
 * n'est perdu une fois la famille recontactée.
 * Réservé aux administrateurs. Réponse : { pending: EnrollmentRow[], handled: EnrollmentRow[] }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const db = supabaseAdmin();
  const [pending, handled] = await Promise.all([
    db.from("enrollment_requests").select(COLUMNS).eq("status", "new").order("created_at", { ascending: true }),
    db.from("enrollment_requests").select(COLUMNS).eq("status", "handled").order("handled_at", { ascending: false }).limit(HANDLED_LIMIT),
  ]);
  if (pending.error) return serverError("/api/admin/enrollments error", pending.error);
  if (handled.error) return serverError("/api/admin/enrollments error", handled.error);

  return NextResponse.json({
    pending: (pending.data ?? []) as EnrollmentRow[],
    handled: (handled.data ?? []) as EnrollmentRow[],
  });
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

  const { data, error } = await supabaseAdmin()
    .from("enrollment_requests")
    .update({ status: "handled", handled_at: new Date().toISOString(), handled_by: auth.user.id })
    .eq("id", parsed.id)
    .eq("status", "new")
    .select(COLUMNS)
    .maybeSingle();
  if (error) return serverError("/api/admin/enrollments error", error);
  if (!data) return NextResponse.json({ error: "Demande introuvable ou déjà traitée" }, { status: 404 });

  return NextResponse.json({ request: data as EnrollmentRow });
}
