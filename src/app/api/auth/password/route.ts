import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { parseNewPassword, parseResetRequest, RESET_PAGE_PATH } from "@/lib/passwordReset";

/**
 * POST /api/auth/password
 *
 *  { action: "request", email }
 *    Demande à Supabase Auth d'envoyer le lien de réinitialisation. Réponse
 *    identique que le compte existe ou non (pas d'énumération des emails).
 *    Supabase limite lui-même la fréquence des envois par adresse.
 *
 *  { action: "update", accessToken, password }
 *    Vérifie le jeton de récupération reçu par email auprès de Supabase,
 *    puis change le mot de passe du compte correspondant.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide toléré */ }

  if (body.action === "request") {
    const parsed = parseResetRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Adresse publique du site si configurée (derrière un proxy, l'origine
    // de la requête peut être interne), sinon celle de la requête.
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.value.email, {
      redirectTo: `${origin}${RESET_PAGE_PATH}`,
    });
    // Erreur (limite d'envoi, SMTP…) : journalisée, jamais révélée à l'appelant.
    if (error) console.error("[password reset] envoi impossible :", error.message);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update") {
    const parsed = parseNewPassword(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.getUser(parsed.value.accessToken);
    if (error || !data.user) {
      return NextResponse.json(
        { error: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau." },
        { status: 400 },
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
      password: parsed.value.password,
    });
    if (updateError) {
      console.error("[password reset] mise à jour impossible :", updateError.message);
      return NextResponse.json({ error: "Impossible de changer le mot de passe. Réessayez." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
