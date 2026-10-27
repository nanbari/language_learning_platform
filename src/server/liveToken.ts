import { createHmac, timingSafeEqual } from "node:crypto";
import { LIVE_TOKEN_TTL_SECONDS } from "@/lib/liveSession";

/**
 * Jeton Realtime du cours en direct.
 *
 * Le navigateur n'a pas de session Supabase (la connexion passe par notre
 * cookie signé) ; pour rejoindre un canal Realtime *privé*, il lui faut
 * pourtant un JWT que Supabase reconnaisse. Le serveur en émet un, court
 * (15 min), signé avec le secret JWT du projet (SUPABASE_JWT_SECRET, jamais
 * exposé), après avoir vérifié que la personne est l'enseignant de la classe
 * ou l'un de ses élèves. Les politiques RLS de realtime.messages (migration
 * 2026-10-28) refont cette vérification à partir de `sub`.
 *
 * Sans secret configuré, aucun jeton n'est émis : la vidéo est indisponible,
 * le reste de la séance (écrans, réponses) continue par les routes API.
 */

export interface LiveTokenClaims {
  iss: "monte-et-souris";
  sub: string;
  aud: "authenticated";
  /** Rôle Postgres pour les politiques RLS. */
  role: "authenticated";
  iat: number;
  exp: number;
  /** Salon de la séance : un jeton ne sert qu'à elle. */
  ms_room: string;
  ms_role: "teacher" | "student";
}


const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** Émet le jeton, ou null si le secret n'est pas configuré. */
export function mintLiveToken(
  claims: { userId: string; room: string; role: "teacher" | "student" },
  secret: string | undefined = process.env.SUPABASE_JWT_SECRET,
  now: number = Date.now(),
): { token: string; expiresAt: number } | null {
  if (!secret || secret.length < 16) return null;
  const iat = Math.floor(now / 1000);
  const payload: LiveTokenClaims = {
    iss: "monte-et-souris",
    sub: claims.userId,
    aud: "authenticated",
    role: "authenticated",
    iat,
    exp: iat + LIVE_TOKEN_TTL_SECONDS,
    ms_room: claims.room,
    ms_role: claims.role,
  };
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return { token: `${head}.${body}.${sig}`, expiresAt: payload.exp * 1000 };
}

/** Vérifie signature et expiration ; rend les claims ou null. (Tests et outils : Supabase fait sa propre vérification.) */
export function verifyLiveToken(token: string, secret: string, now: number = Date.now()): LiveTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as LiveTokenClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export interface IssuedLiveToken {
  token: string;
  expiresAt: number;
  /** « hs256 » : signé ici avec SUPABASE_JWT_SECRET (15 min) ; « supabase-auth » : vraie session Supabase de la personne. */
  source: "hs256" | "supabase-auth";
}

/**
 * Jeton Realtime pour une personne autorisée (vérifiée en amont par liveAccess).
 *
 * 1. Si SUPABASE_JWT_SECRET est configuré : jeton court signé ici.
 * 2. Sinon : une vraie session Supabase Auth de la personne, obtenue côté
 *    serveur — lien magique généré par l'API admin puis échangé aussitôt
 *    (le lien n'est jamais envoyé ni montré). Fonctionne quel que soit le
 *    mode de signature du projet (secret HS256 ou clés asymétriques) ; dure
 *    le temps d'une session Supabase (une heure par défaut).
 * Dans les deux cas `sub` est l'identifiant de la personne : les politiques
 * de realtime.messages n'ont besoin que de lui.
 */
export async function issueLiveToken(
  user: { id: string; email: string },
  room: string,
  role: "teacher" | "student",
): Promise<IssuedLiveToken | null> {
  const minted = mintLiveToken({ userId: user.id, room, role });
  if (minted) return { ...minted, source: "hs256" };

  const { supabaseAdmin, supabaseAnonClient } = await import("@/server/supabase");
  const link = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email: user.email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.warn("[live] jeton Supabase Auth impossible (lien) :", link.error?.message ?? "pas de jeton");
    return null;
  }
  const verified = await supabaseAnonClient().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const session = verified.data?.session;
  if (verified.error || !session) {
    console.warn("[live] jeton Supabase Auth impossible (échange) :", verified.error?.message ?? "pas de session");
    return null;
  }
  const expiresAt = (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000;
  return { token: session.access_token, expiresAt, source: "supabase-auth" };
}
