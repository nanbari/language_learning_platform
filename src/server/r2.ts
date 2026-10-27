/**
 * Cloudflare R2 — stockage objet S3-compatible pour les médias lourds
 * (vidéos, audios, images des leçons). Le plan gratuit offre 10 GB et,
 * surtout, aucun frais de sortie : le streaming vers les élèves ne coûte
 * rien, contrairement au stockage Supabase (1 GB, 5 GB d'egress/mois).
 *
 * Les fichiers ne transitent PAS par le serveur Next.js : le client obtient
 * une URL signée (PUT) via /api/media puis téléverse directement vers R2.
 * La lecture se fait par l'URL publique du bucket (R2_PUBLIC_BASE_URL).
 * La suppression (leçon effacée, enregistrement remplacé) se fait d'ici,
 * par une URL signée DELETE, au mieux : un échec est journalisé, jamais
 * bloquant.
 *
 * La signature AWS SigV4 (query presign) est calculée ici avec node:crypto
 * plutôt qu'avec le SDK AWS : pas de dépendance lourde, et le SDK provoquait
 * des liens symboliques dans .next que Windows refuse de créer.
 *
 * Variables d'environnement (Netlify : Site configuration → Environment
 * variables ; à créer depuis le dashboard Cloudflare → R2) :
 *  - R2_ACCOUNT_ID          id du compte Cloudflare
 *  - R2_ACCESS_KEY_ID       clé du token API R2 ("Object Read & Write")
 *  - R2_SECRET_ACCESS_KEY   secret associé
 *  - R2_BUCKET              nom du bucket (ex. monte-et-souris-media)
 *  - R2_PUBLIC_BASE_URL     domaine public du bucket, sans slash final
 *                           (ex. https://pub-xxxx.r2.dev ou domaine custom)
 *
 * Le bucket doit autoriser le PUT depuis le site (Settings → CORS policy) :
 * AllowedOrigins = origine du site, AllowedMethods = ["PUT"],
 * AllowedHeaders = ["content-type"].
 */
import { createHash, createHmac } from "crypto";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquante`);
  return v;
}

export const UPLOAD_URL_TTL_SECONDS = 600; // 10 minutes
const DELETE_URL_TTL_SECONDS = 60;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();

// Encodage RFC 3986 strict exigé par SigV4 (encodeURIComponent laisse
// passer ! ' ( ) *).
function awsEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** URL signée (SigV4, query presign) pour `method` sur `key`, avec les en-têtes donnés signés. */
function presign(method: "PUT" | "DELETE", key: string, headers: Record<string, string>, expires: number): string {
  const host = `${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
  const path = `/${env("R2_BUCKET")}/` + key.split("/").map(awsEncode).join("/");

  const now = new Date();
  const datetime = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // YYYYMMDDTHHMMSSZ
  const date = datetime.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const all: Record<string, string> = { ...headers, host };
  const names = Object.keys(all).sort();
  const signedHeaders = names.join(";");

  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${env("R2_ACCESS_KEY_ID")}/${scope}`],
    ["X-Amz-Date", datetime],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];
  const query = params.map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`).join("&");

  const canonicalRequest = [
    method,
    path,
    query,
    ...names.map((n) => `${n}:${all[n]}`),
    "",
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", datetime, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac("AWS4" + env("R2_SECRET_ACCESS_KEY"), date);
  const kSigning = hmac(hmac(hmac(kDate, "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`;
}

/**
 * URL signée pour téléverser `key` directement vers R2 en PUT. Content-Type
 * et Content-Length font partie des en-têtes signés : le client ne peut pas
 * envoyer autre chose que ce que la route /api/media a validé.
 */
export function presignUpload(key: string, contentType: string, contentLength: number): string {
  return presign("PUT", key, { "content-length": String(contentLength), "content-type": contentType }, UPLOAD_URL_TTL_SECONDS);
}

/** URL publique (lecture) d'un objet du bucket. */
export function publicUrl(key: string): string {
  return `${env("R2_PUBLIC_BASE_URL")}/${key}`;
}

/** Clé d'objet d'une URL publique de ce bucket ; null si l'URL vient d'ailleurs. */
export function keyFromPublicUrl(url: string, base: string | undefined = process.env.R2_PUBLIC_BASE_URL): string | null {
  if (!base) return null;
  const prefix = base.replace(/\/$/, "") + "/";
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length).split(/[?#]/)[0];
  return key && !key.includes("..") ? decodeURIComponent(key) : null;
}

/** Toutes les URLs de ce bucket présentes dans une structure JSON (leçon, diaporama…). */
export function collectMediaUrls(value: unknown, base: string | undefined = process.env.R2_PUBLIC_BASE_URL): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") { if (keyFromPublicUrl(v, base)) found.add(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

/**
 * Supprime des objets du bucket, au mieux : les URLs d'ailleurs sont
 * ignorées, un échec est journalisé. Rend le nombre d'objets supprimés.
 */
export async function deleteObjects(urls: readonly string[]): Promise<number> {
  let deleted = 0;
  for (const url of urls) {
    const key = keyFromPublicUrl(url);
    if (!key) continue;
    try {
      const res = await fetch(presign("DELETE", key, {}, DELETE_URL_TTL_SECONDS), { method: "DELETE" });
      if (res.ok || res.status === 404) deleted += 1;
      else console.warn(`[r2] suppression refusée (${res.status}) pour ${key}`);
    } catch (e) {
      console.warn(`[r2] suppression impossible pour ${key} :`, e instanceof Error ? e.message : e);
    }
  }
  return deleted;
}
