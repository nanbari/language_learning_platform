import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { parseEnrollmentAction, type EnrollmentRow } from "@/lib/enrollment";
import { requireAdmin } from "@/server/session";
import { serverError } from "@/server/errors";

const COLUMNS = "id, parent_name, email, phone, child_name, child_age, level, letters, known_letters, letter_forms, known_letter_forms, vocabulary, vocabulary_domains, vocabulary_other, status, created_at, handled_at, ended_at";

/** Demandes inscrites / sans suite renvoyées (les plus récentes) : l'historique reste consultable sans alourdir la page. */
const HISTORY_LIMIT = 300;

/**
 * GET /api/admin/enrollments
 * Demandes d'inscription à traiter (les plus anciennes d'abord), enfants
 * inscrits et demandes classées sans suite (les plus récentes d'abord,
 * HISTORY_LIMIT au plus chacune). Réservé aux administrateurs.
 * Réponse : { pending: EnrollmentRow[], enrolled: EnrollmentRow[], closed: EnrollmentRow[] }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const db = supabaseAdmin();
  const [pending, enrolled, closed] = await Promise.all([
    db.from("enrollment_requests").select(COLUMNS).eq("status", "new").order("created_at", { ascending: true }),
    db.from("enrollment_requests").select(COLUMNS).eq("status", "enrolled").order("handled_at", { ascending: false }).limit(HISTORY_LIMIT),
    db.from("enrollment_requests").select(COLUMNS).eq("status", "closed").order("handled_at", { ascending: false }).limit(HISTORY_LIMIT),
  ]);
  for (const r of [pending, enrolled, closed]) {
    if (r.error) return serverError("/api/admin/enrollments error", r.error);
  }

  return NextResponse.json({
    pending: (pending.data ?? []) as EnrollmentRow[],
    enrolled: (enrolled.data ?? []) as EnrollmentRow[],
    closed: (closed.data ?? []) as EnrollmentRow[],
  });
}

/**
 * POST /api/admin/enrollments  { id, action }
 * Décision de l'admin sur une demande (voir EnrollmentAction) :
 *  - "enroll" : l'enfant est inscrit, la demande (coordonnées du parent) est conservée ;
 *  - "close"  : famille recontactée, pas d'inscription ; effacée 6 mois plus tard ;
 *  - "end"    : l'enfant inscrit arrête les cours ; effacée un an plus tard.
 * Les effacements sont faits par la tâche planifiée de la base
 * (migration 2026-11-07_enrollment_requests_retention). Réservé aux administrateurs.
 *
 * Réponses :
 *  200 { request }   demande mise à jour
 *  400               corps invalide
 *  404               demande introuvable, ou pas dans l'état attendu par l'action
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = parseEnrollmentAction(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const now = new Date().toISOString();

  let query = supabaseAdmin().from("enrollment_requests")
    .update(parsed.action === "end"
      ? { ended_at: now }
      : { status: parsed.action === "enroll" ? "enrolled" : "closed", handled_at: now, handled_by: auth.user.id })
    .eq("id", parsed.id);
  query = parsed.action === "end" ? query.eq("status", "enrolled").is("ended_at", null) : query.eq("status", "new");

  const { data, error } = await query.select(COLUMNS).maybeSingle();
  if (error) return serverError("/api/admin/enrollments error", error);
  if (!data) {
    return NextResponse.json({
      error: parsed.action === "end" ? "Inscription introuvable ou déjà terminée" : "Demande introuvable ou déjà traitée",
    }, { status: 404 });
  }

  return NextResponse.json({ request: data as EnrollmentRow });
}
