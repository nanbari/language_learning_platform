/**
 * Server-side session helper.
 *
 * Sessions are stored in a signed httpOnly cookie so they cannot be forged
 * from the browser. The signature uses HMAC-SHA256 over a JSON payload via
 * Web Crypto (works in both Node and the Next.js edge runtime).
 *
 * The signing key comes from AUTH_SECRET. In production this MUST be set.
 * In dev a deterministic fallback is used so the app boots, but a warning
 * is logged the first time it is read.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "student" | "teacher" | "admin";
};

export type Session = SessionUser & {
  exp: number; // unix seconds
};

export const COOKIE_NAME = "ms_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let warned = false;

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  if (!warned) {
    console.warn("[auth] AUTH_SECRET missing — using insecure dev fallback");
    warned = true;
  }
  return "dev-only-fallback-secret-change-me-please";
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const c of u8) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const norm = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlEncode(sig);
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(user: SessionUser, ttl = SESSION_TTL_SECONDS): Promise<string> {
  const session: Session = { ...user, exp: Math.floor(Date.now() / 1000) + ttl };
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const json = new TextDecoder().decode(b64urlDecode(payload));
    const parsed = JSON.parse(json) as Session;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (parsed.role !== "student" && parsed.role !== "teacher" && parsed.role !== "admin") return null;
    return parsed;
  } catch { return null; }
}
