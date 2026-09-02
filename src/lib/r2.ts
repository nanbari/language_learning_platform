/**
 * Cloudflare R2 — stockage objet S3-compatible pour les médias lourds
 * (vidéos, audios, images des leçons). Le plan gratuit offre 10 GB et,
 * surtout, aucun frais de sortie : le streaming vers les élèves ne coûte
 * rien, contrairement au stockage Supabase (1 GB, 5 GB d'egress/mois).
 *
 * Les fichiers ne transitent PAS par le serveur Next.js : le client obtient
 * une URL signée (PUT) via /api/media puis téléverse directement vers R2.
 * La lecture se fait par l'URL publique du bucket (R2_PUBLIC_BASE_URL).
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
 * AllowedHeaders = ["content-type"]. Côté CSP (next.config.ts), le jour où
 * l'UI d'upload est branchée : ajouter https://*.r2.cloudflarestorage.com à
 * connect-src et l'URL publique du bucket à media-src.
 */
import { createHash, createHmac } from "crypto";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquante`);
  return v;
}

export const UPLOAD_URL_TTL_SECONDS = 600; // 10 minutes

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();

// Encodage RFC 3986 strict exigé par SigV4 (encodeURIComponent laisse
// passer ! ' ( ) *).
function awsEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * URL signée (SigV4, query presign) pour téléverser `key` directement vers
 * R2 en PUT. Content-Type et Content-Length font partie des en-têtes
 * signés : le client ne peut pas envoyer autre chose que ce que la route
 * /api/media a validé.
 */
export function presignUpload(
  key: string,
  contentType: string,
  contentLength: number,
): string {
  const host = `${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
  const path = `/${env("R2_BUCKET")}/` + key.split("/").map(awsEncode).join("/");

  const now = new Date();
  const datetime = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // YYYYMMDDTHHMMSSZ
  const date = datetime.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const signedHeaders = "content-length;content-type;host";

  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${env("R2_ACCESS_KEY_ID")}/${scope}`],
    ["X-Amz-Date", datetime],
    ["X-Amz-Expires", String(UPLOAD_URL_TTL_SECONDS)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];
  const query = params.map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`).join("&");

  const canonicalRequest = [
    "PUT",
    path,
    query,
    `content-length:${contentLength}`,
    `content-type:${contentType}`,
    `host:${host}`,
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

/** URL publique (lecture) d'un objet du bucket. */
export function publicUrl(key: string): string {
  return `${env("R2_PUBLIC_BASE_URL")}/${key}`;
}
