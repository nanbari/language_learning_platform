import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { parseSignupInput } from "@/lib/signup";

// Client service-role : la RLS est contournée — ne jamais exposer ce client
// au navigateur. Cette route est publique : elle n'écrit que dans
// signup_requests et ne crée jamais de compte.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

/** Coût bcrypt : ~100 ms par hachage, suffisant pour un formulaire public. */
const BCRYPT_ROUNDS = 10;

/**
 * POST /api/signup  { name, email, password }
 * Enregistre une demande de compte élève, en attente d'approbation par un
 * administrateur. Le mot de passe est haché ici et ne transite plus jamais
 * en clair.
 *
 * Réponses :
 *  201 { ok: true }   demande enregistrée
 *  400                formulaire invalide
 *  409                compte existant ou demande déjà en attente
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = parseSignupInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, email, password } = parsed.value;

  const db = supabase();

  const { data: existingUser, error: userError } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (existingUser) {
    return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail" }, { status: 409 });
  }

  const { data: pending, error: pendingError } = await db
    .from("signup_requests")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
  if (pending) {
    return NextResponse.json({ error: "Une demande est déjà en attente pour cette adresse e-mail" }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { error: insertError } = await db
    .from("signup_requests")
    .insert({ name, email, password_hash, status: "pending" });
  if (insertError) {
    // Index unique (email, pending) : deux envois simultanés du même formulaire
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Une demande est déjà en attente pour cette adresse e-mail" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
