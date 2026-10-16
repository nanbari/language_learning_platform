import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isStaff, type SessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/classes";

// Client service-role : la RLS est contournée, l'autorisation est faite dans
// chaque route (session + rôle + propriété) — ne jamais l'exposer au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
export const supabase = () => (adminClient ??= supabaseAdmin());

/**
 * La classe `id`, si l'enseignant connecté peut la gérer (la sienne, ou
 * n'importe laquelle pour un admin) ; sinon la réponse d'erreur à renvoyer.
 */
export async function ownedClass(session: SessionUser | null, id: string) {
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isStaff(session)) return { error: NextResponse.json({ error: "Interdit" }, { status: 403 }) };
  if (!isUuid(id)) return { error: NextResponse.json({ error: "Classe introuvable" }, { status: 404 }) };

  const { data, error } = await supabase().from("classes").select("id, teacher_id").eq("id", id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!data || (data.teacher_id !== session.id && !session.isAdmin)) {
    return { error: NextResponse.json({ error: "Classe introuvable" }, { status: 404 }) };
  }
  return { id: data.id as string };
}
