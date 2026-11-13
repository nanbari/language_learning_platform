import { supabaseAdmin } from "@/server/supabase";
import { isMissingColumn, warnOnce } from "@/server/errors";
import type { ProfileRow } from "@/server/session";

/**
 * Profils élèves actifs de la famille de `profile` (voir lib/family) : le
 * compte porteur (adresse et mot de passe du parent) et les frères et sœurs
 * qui lui sont rattachés, du plus ancien au plus récent. Relu en base à
 * chaque appel : un profil désactivé ou détaché disparaît aussitôt.
 *
 * Seuls des profils élèves sans droit admin en font partie ; pour un
 * enseignant ou un admin, la liste est vide (jamais de changement de profil
 * vers ou depuis un compte de l'équipe).
 *
 * Lève une erreur si la base ne répond pas : l'appelant refuse, il ne devine pas.
 */
export async function familyProfiles(profile: ProfileRow): Promise<ProfileRow[]> {
  if (!isFamilyMember(profile)) return [];
  const db = supabaseAdmin();
  const rootId = profile.family_account_id ?? profile.id;

  const [root, attached] = await Promise.all([
    rootId === profile.id
      ? Promise.resolve({ data: [profile], error: null })
      : db.from("users").select("*").eq("id", rootId),
    db.from("users").select("*").eq("family_account_id", rootId),
  ]);
  if (root.error) throw new Error(root.error.message);
  let siblings = (attached.data ?? []) as ProfileRow[];
  if (attached.error) {
    // Migration 2026-11-12 pas encore passée : pas de familles, chacun son compte.
    if (!isMissingColumn(attached.error)) throw new Error(attached.error.message);
    warnOnce("colonne users.family_account_id absente : comptes famille désactivés (migration 2026-11-12)");
    siblings = [];
  }

  return [...((root.data ?? []) as ProfileRow[]), ...siblings]
    .filter((p) => isFamilyMember(p) && !p.disabled_at)
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

function isFamilyMember(p: ProfileRow): boolean {
  return p.role === "student" && p.is_admin !== true;
}
