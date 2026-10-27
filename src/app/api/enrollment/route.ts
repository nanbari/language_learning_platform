import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/server/rateLimit";
import { supabaseAdmin } from "@/server/supabase";
import { parseEnrollmentInput } from "@/lib/enrollment";
import { serverError } from "@/server/errors";

/**
 * POST /api/enrollment  { parentName, email, phone, children: [{ name, age, level }], consent, website }
 * Enregistre une demande par enfant, avec les coordonnées du parent, que l'équipe traite à la
 * main (recontact de la famille). `website` est un champ piège invisible :
 * rempli, c'est un robot ; on répond comme si tout allait bien sans rien
 * enregistrer.
 *
 * Réponses :
 *  201 { ok: true }   demande enregistrée
 *  400                formulaire invalide
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as Record<string, unknown>).website === "string"
    && ((body as Record<string, unknown>).website as string).trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const parsed = parseEnrollmentInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const limited = await rateLimit(req, "enrollment");
  if (limited) return limited;
  const v = parsed.value;

  const consentAt = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from("enrollment_requests")
    .insert(v.children.map((child) => ({
      parent_name: v.parentName,
      email: v.email,
      phone: v.phone,
      child_name: child.name,
      child_age: child.age,
      level: child.level,
      consent_at: consentAt,
    })));
  if (error) return serverError("/api/enrollment error", error);

  return NextResponse.json({ ok: true }, { status: 201 });
}
