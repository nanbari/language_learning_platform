import { NextRequest } from "next/server";
import { COOKIE_NAME, signSession, type SessionUser } from "@/server/auth";

/**
 * Requêtes et identités synthétiques pour tester les routes API comme le
 * navigateur les appelle : cookie signé avec le secret de test, corps JSON.
 * Aucune identité réelle, aucun identifiant de production.
 */

export const TEST_SECRET = "vitest-secret-0123456789abcdef";
process.env.AUTH_SECRET = TEST_SECRET;

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const makeUser = (n: number, role: "student" | "teacher", isAdmin = false, name?: string): SessionUser => ({
  id: uuid(n),
  email: `user${n}@test.invalid`,
  name: name ?? (role === "student" ? `Élève ${n}` : `Enseignant ${n}`),
  role,
  isAdmin,
});

/** Ligne public.users correspondant à une identité. */
export const profileRow = (u: SessionUser, extra: Record<string, unknown> = {}) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, is_admin: u.isAdmin, created_at: "2026-01-01T00:00:00Z", ...extra,
});

export interface RequestOptions {
  /** Identité du cookie ; `null` = anonyme. Un objet SessionUser est signé tel quel (ses prétentions peuvent différer de la base). */
  as?: SessionUser | null;
  /** Cookie brut (jeton expiré, falsifié…). */
  cookie?: string;
  body?: unknown;
  /** Corps brut, non JSON. */
  rawBody?: string;
  ttl?: number;
}

export async function request(method: string, path: string, opts: RequestOptions = {}): Promise<NextRequest> {
  const headers = new Headers();
  let cookie = opts.cookie;
  if (opts.as) cookie = await signSession(opts.as, opts.ttl !== undefined ? { ttl: opts.ttl } : {});
  if (cookie) headers.set("cookie", `${COOKIE_NAME}=${cookie}`);
  let body: string | undefined;
  if (opts.rawBody !== undefined) { body = opts.rawBody; headers.set("content-type", "application/json"); }
  else if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers.set("content-type", "application/json"); }
  if (method === "GET" || method === "HEAD") body = undefined;
  return new NextRequest(`http://localhost${path}`, { method, headers, body });
}

export const params = (id: string) => ({ params: Promise.resolve({ id }) });

export async function json(res: Response): Promise<Record<string, unknown> & { error?: string }> {
  return (await res.clone().json()) as Record<string, unknown> & { error?: string };
}

/** Le texte d'une réponse ne doit contenir aucun de ces fragments (fuite de donnée ou de détail interne). */
export async function assertAbsent(res: Response, fragments: string[]) {
  const text = await res.clone().text();
  for (const f of fragments) {
    if (text.includes(f)) throw new Error(`la réponse contient « ${f} » : ${text.slice(0, 200)}`);
  }
}
