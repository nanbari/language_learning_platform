import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";

/**
 * Limitation de débit des routes publiques, par adresse IP (et e-mail quand il
 * y en a un), comptée en base par la fonction `rate_limit_hit` (migration
 * 2026-10-29) : le serveur est sans état, le compteur doit vivre ailleurs.
 *
 * Si la fonction n'est pas (encore) installée, on laisse passer en le
 * signalant une fois : c'est le comportement d'avant, pas une régression.
 * La réponse de refus ne dit rien de plus que « trop de tentatives ».
 */

export interface RateRule {
  /** Nombre d'appels admis par fenêtre. */
  limit: number;
  windowSeconds: number;
}

export const RATE_RULES = {
  /** Connexion : par IP + e-mail, pour ne pas bloquer toute une école derrière une seule adresse. */
  login: { limit: 10, windowSeconds: 10 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  enrollment: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateRule>;

let warned = false;

/** Adresse du client, telle que Netlify ou un proxy la transmet. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-nf-client-connection-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"
  );
}

/**
 * `null` si l'appel est admis ; sinon la réponse 429 à renvoyer telle quelle.
 * `subject` (e-mail normalisé…) affine la clé quand il est connu.
 */
export async function rateLimit(req: NextRequest, scope: keyof typeof RATE_RULES, subject?: string): Promise<NextResponse | null> {
  const rule = RATE_RULES[scope];
  const key = `${scope}:${clientIp(req)}${subject ? ":" + subject.toLowerCase() : ""}`;
  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", { p_key: key, p_window_seconds: rule.windowSeconds, p_limit: rule.limit });
    if (error) {
      if (!warned) { warned = true; console.warn("[rate-limit] fonction indisponible, aucune limitation :", error.message); }
      return null;
    }
    if (data === false) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        { status: 429, headers: { "Retry-After": String(rule.windowSeconds) } },
      );
    }
    return null;
  } catch (e) {
    if (!warned) { warned = true; console.warn("[rate-limit] indisponible, aucune limitation :", e instanceof Error ? e.message : e); }
    return null;
  }
}
