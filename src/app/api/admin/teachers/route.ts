import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { parseNewTeacher, type StaffRow } from "@/lib/staff";
import { RESET_PAGE_PATH } from "@/lib/passwordReset";

// Client service-role : la RLS est contournée, l'autorisation (droit admin)
// est faite ici même — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

const EXISTS_RE = /already been registered|already exists|already registered/i;

/**
 * POST /api/admin/teachers  { name, email, isAdmin? }
 * Crée un compte enseignant sans mot de passe. Supabase Auth lui envoie un
 * e-mail d'invitation (SMTP configuré dans Supabase) ; en ouvrant le lien,
 * il arrive sur /reinitialiser-mot-de-passe et choisit lui-même son mot de
 * passe. Si l'e-mail ne part pas (SMTP absent, limite d'envoi…), le lien
 * d'invitation est rendu à l'admin pour qu'il le transmette lui-même.
 * Réservé aux administrateurs.
 *
 * Réponses :
 *  201 { user: StaffRow, emailSent: true }
 *  201 { user: StaffRow, emailSent: false, inviteLink, emailError }
 *  409  un compte existe déjà avec cette adresse e-mail
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

  const parsed = parseNewTeacher(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, email, isAdmin } = parsed.value;

  const db = supabase();
  const exists = () => NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail" }, { status: 409 });

  // Un profil existe déjà : on ne touche à rien (ni compte Auth, ni profil).
  const { data: existing, error: lookupError } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing) return exists();

  // Adresse publique du site si configurée (derrière un proxy, l'origine de
  // la requête peut être interne), sinon celle de la requête.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const redirectTo = `${origin}${RESET_PAGE_PATH}`;
  const data = { name, role: "teacher" };

  // 1. Invitation envoyée par e-mail par Supabase.
  let userId: string | null = null;
  let inviteLink: string | null = null;
  let emailError: string | null = null;
  let createdHere = true;
  const invited = await db.auth.admin.inviteUserByEmail(email, { data, redirectTo });
  if (invited.data.user && !invited.error) {
    userId = invited.data.user.id;
  } else {
    if (invited.error?.status === 422 && EXISTS_RE.test(invited.error.message)) return exists();
    emailError = invited.error?.message ?? "envoi impossible";
    console.error("[teachers] invitation non envoyée :", emailError);

    // 2. Secours : lien d'invitation à transmettre par l'admin.
    let link = await db.auth.admin.generateLink({ type: "invite", email, options: { data, redirectTo } });
    if (link.error && EXISTS_RE.test(link.error.message)) {
      // Compte Auth sans profil (invitation interrompue, ou compte créé dans le
      // dashboard et jamais utilisé) : lien pour y choisir un mot de passe.
      createdHere = false;
      link = await db.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    }
    if (link.error || !link.data.user || !link.data.properties?.action_link) {
      return NextResponse.json({ error: link.error?.message ?? "Création du compte impossible" }, { status: 500 });
    }
    userId = link.data.user.id;
    inviteLink = link.data.properties.action_link;
  }

  const { data: profile, error: profileError } = await db
    .from("users")
    // is_admin seulement si demandé : la colonne a une valeur par défaut (false).
    .insert({ id: userId, email, name, role: "teacher", ...(isAdmin ? { is_admin: true } : {}) })
    .select("id, name, email, created_at")
    .single();
  if (profileError || !profile) {
    // Compte Auth créé à l'instant : on l'efface pour pouvoir réessayer.
    if (createdHere) await db.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: profileError?.message ?? "Création du profil impossible" }, { status: 500 });
  }

  const user: StaffRow = { id: profile.id, name: profile.name, email: profile.email, createdAt: profile.created_at, isAdmin };
  return NextResponse.json(
    inviteLink ? { user, emailSent: false, inviteLink, emailError } : { user, emailSent: true },
    { status: 201 },
  );
}
