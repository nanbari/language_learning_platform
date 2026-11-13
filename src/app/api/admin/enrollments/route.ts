import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { parseEnrollmentAction, type EnrollmentAccount, type EnrollmentRow } from "@/lib/enrollment";
import { RESET_PAGE_PATH } from "@/lib/passwordReset";
import { familyAliasEmail } from "@/lib/family";
import { requireAdmin } from "@/server/session";
import { serverError } from "@/server/errors";

const COLUMNS = "id, parent_name, email, phone, child_name, child_age, level, letters, known_letters, letter_forms, known_letter_forms, vocabulary, vocabulary_domains, vocabulary_other, status, created_at, handled_at, ended_at, student_id";

/** Demandes inscrites / sans suite renvoyées (les plus récentes) : l'historique reste consultable sans alourdir la page. */
const HISTORY_LIMIT = 300;

const EXISTS_RE = /already been registered|already exists|already registered/i;
const NOT_PENDING = "Demande introuvable ou déjà traitée";

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
 * POST /api/admin/enrollments  { id, action, accountEmail? }
 * Décision de l'admin sur une demande (voir EnrollmentAction) :
 *  - "enroll" : l'enfant est inscrit, la demande (coordonnées du parent) est conservée,
 *               et son compte élève est créé (voir enroll ci-dessous) ;
 *  - "close"  : famille recontactée, pas d'inscription ; effacée 6 mois plus tard ;
 *  - "end"    : l'enfant inscrit arrête les cours ; effacée un an plus tard.
 * Les effacements sont faits par la tâche planifiée de la base
 * (migration 2026-11-07_enrollment_requests_retention). Réservé aux administrateurs.
 *
 * Réponses :
 *  200 { request }            demande mise à jour ("close", "end")
 *  200 { request, account }   "enroll" : compte élève créé (voir EnrollmentAccount)
 *  400                        corps invalide
 *  404                        demande introuvable, ou pas dans l'état attendu par l'action
 *  409                        "enroll" : un compte existe déjà avec cette adresse ; rien n'est changé
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = parseEnrollmentAction(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const now = new Date().toISOString();

  if (parsed.action === "enroll") return enroll(req, parsed.id, parsed.accountEmail, auth.user.id, now);

  let query = supabaseAdmin().from("enrollment_requests")
    .update(parsed.action === "end"
      ? { ended_at: now }
      : { status: "closed", handled_at: now, handled_by: auth.user.id })
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

/**
 * « Inscrit » : crée le compte élève de l'enfant, puis marque la demande.
 *
 * Le compte (Supabase Auth + profil `users`, rôle élève fixé ici, jamais lu
 * dans la requête) est créé sans mot de passe, au prénom de l'enfant et à
 * l'adresse de la demande — ou à `accountEmail` si l'admin en indique une
 * autre. Supabase Auth envoie l'e-mail d'invitation ; le lien mène à
 * /reinitialiser-mot-de-passe, où la famille choisit le mot de passe. Si
 * l'e-mail ne part pas (SMTP absent, limite d'envoi…), le lien est rendu à
 * l'admin pour qu'il le transmette lui-même.
 *
 * Fratrie : si l'adresse de la demande porte déjà le compte élève d'un frère
 * ou d'une sœur, l'enfant est rattaché à ce compte famille (enrollInFamily).
 *
 * Une demande n'est « inscrite » que si le compte existe : adresse prise par
 * un autre compte (enseignant, adresse saisie déjà utilisée) → 409 et rien ne
 * change ; échec en cours de route → le compte créé à l'instant est défait et
 * la demande reste à traiter.
 */
async function enroll(req: NextRequest, id: string, accountEmail: string | undefined, adminId: string, now: string) {
  const db = supabaseAdmin();

  const { data: pending, error: loadError } = await db.from("enrollment_requests")
    .select("id, email, child_name, status").eq("id", id).maybeSingle();
  if (loadError) return serverError("/api/admin/enrollments loadError", loadError);
  if (!pending || pending.status !== "new") return NextResponse.json({ error: NOT_PENDING }, { status: 404 });

  const email: string = accountEmail ?? pending.email;
  const name: string = pending.child_name;
  const taken = () => NextResponse.json({
    error: `Un compte existe déjà avec l'adresse ${email}. Indiquez une autre adresse e-mail pour le compte de ${name}.`,
    code: "email_taken",
  }, { status: 409 });

  const { data: existing, error: lookupError } = await db.from("users").select("id, role, is_admin").eq("email", email).maybeSingle();
  if (lookupError) return serverError("/api/admin/enrollments lookupError", lookupError);
  if (existing) {
    // L'adresse du parent porte déjà le compte élève d'un frère ou d'une sœur :
    // l'enfant rejoint ce compte famille. Seulement pour l'adresse de la demande
    // elle-même (pas une adresse saisie par l'admin), et jamais sur le compte
    // d'un enseignant ou d'un admin : là, il faut une autre adresse.
    if (!accountEmail && existing.role === "student" && existing.is_admin !== true) {
      return enrollInFamily(id, name, email, existing.id, adminId, now);
    }
    return taken();
  }

  // Adresse publique du site si configurée (derrière un proxy, l'origine de
  // la requête peut être interne), sinon celle de la requête.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const redirectTo = `${origin}${RESET_PAGE_PATH}`;
  const data = { name, role: "student" };

  // 1. Invitation envoyée par e-mail par Supabase.
  let userId: string;
  let inviteLink: string | null = null;
  let createdHere = true;
  const invited = await db.auth.admin.inviteUserByEmail(email, { data, redirectTo });
  if (invited.data.user && !invited.error) {
    userId = invited.data.user.id;
  } else {
    if (invited.error?.status === 422 && EXISTS_RE.test(invited.error.message)) return taken();
    console.error("[enrollments] invitation non envoyée :", invited.error?.message ?? "envoi impossible");

    // 2. Secours : lien d'invitation à transmettre par l'admin.
    let link = await db.auth.admin.generateLink({ type: "invite", email, options: { data, redirectTo } });
    if (link.error && EXISTS_RE.test(link.error.message)) {
      // Compte Auth resté sans profil (invitation interrompue) : lien pour y choisir un mot de passe.
      createdHere = false;
      link = await db.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    }
    if (link.error || !link.data.user || !link.data.properties?.action_link) {
      return serverError("/api/admin/enrollments linkError", link.error ?? "lien d'invitation absent");
    }
    userId = link.data.user.id;
    inviteLink = link.data.properties.action_link;
  }

  // Défait ce qui vient d'être créé, pour que l'admin puisse réessayer.
  const undo = async (profile: boolean) => {
    if (profile) await db.from("users").delete().eq("id", userId);
    if (createdHere) await db.auth.admin.deleteUser(userId).catch(() => {});
  };

  const { error: profileError } = await db.from("users").insert({ id: userId, email, name, role: "student" });
  if (profileError) {
    // Le profil de ce compte existe déjà : Supabase a renvoyé l'invitation d'un
    // compte pas encore activé au lieu d'en créer un — celui d'un frère ou d'une
    // sœur inscrit au même instant (deux clics rapprochés). Ce compte n'est pas
    // le nôtre : surtout ne pas le défaire ; l'enfant le rejoint comme compte famille.
    if (profileError.code === "23505") {
      const { data: owner, error: ownerError } = await db.from("users").select("id, role, is_admin").eq("id", userId).maybeSingle();
      if (ownerError) return serverError("/api/admin/enrollments ownerError", ownerError);
      if (owner && !accountEmail && owner.role === "student" && owner.is_admin !== true) {
        return enrollInFamily(id, name, email, owner.id, adminId, now);
      }
      return taken();
    }
    await undo(false);
    return serverError("/api/admin/enrollments profileError", profileError);
  }

  // La demande n'est marquée que si elle est toujours à traiter (décision concurrente d'un autre admin).
  const { data: updated, error: updateError } = await db.from("enrollment_requests")
    .update({ status: "enrolled", handled_at: now, handled_by: adminId, student_id: userId })
    .eq("id", id).eq("status", "new")
    .select(COLUMNS).maybeSingle();
  if (updateError || !updated) {
    await undo(true);
    if (updateError) return serverError("/api/admin/enrollments updateError", updateError);
    return NextResponse.json({ error: NOT_PENDING }, { status: 404 });
  }

  const account: EnrollmentAccount = inviteLink ? { kind: "link", email, inviteLink } : { kind: "invited", email };
  return NextResponse.json({ request: updated as EnrollmentRow, account });
}

/**
 * « Inscrit » pour un frère ou une sœur : profil élève rattaché au compte
 * famille `familyAccountId` (voir lib/family). Le profil a son propre compte
 * Auth, sans mot de passe et à une adresse technique : on y entre avec
 * l'adresse et le mot de passe du parent, en choisissant le prénom. Aucun
 * e-mail n'est envoyé (la famille a déjà reçu celui du premier enfant).
 */
async function enrollInFamily(id: string, name: string, familyEmail: string, familyAccountId: string, adminId: string, now: string) {
  const db = supabaseAdmin();
  const email = familyAliasEmail(crypto.randomUUID());

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name, role: "student" },
  });
  if (createError || !created.user) return serverError("/api/admin/enrollments createError", createError ?? "compte non créé");
  const userId = created.user.id;

  const undo = async (profile: boolean) => {
    if (profile) await db.from("users").delete().eq("id", userId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
  };

  const { error: profileError } = await db.from("users")
    .insert({ id: userId, email, name, role: "student", family_account_id: familyAccountId });
  if (profileError) {
    await undo(false);
    return serverError("/api/admin/enrollments profileError", profileError);
  }

  const { data: updated, error: updateError } = await db.from("enrollment_requests")
    .update({ status: "enrolled", handled_at: now, handled_by: adminId, student_id: userId })
    .eq("id", id).eq("status", "new")
    .select(COLUMNS).maybeSingle();
  if (updateError || !updated) {
    await undo(true);
    if (updateError) return serverError("/api/admin/enrollments updateError", updateError);
    return NextResponse.json({ error: NOT_PENDING }, { status: 404 });
  }

  const account: EnrollmentAccount = { kind: "family", email: familyEmail };
  return NextResponse.json({ request: updated as EnrollmentRow, account });
}
