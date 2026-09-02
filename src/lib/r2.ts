/**
 * Cloudflare R2 — stockage objet S3-compatible pour les médias lourds
 * (vidéos, audios, images des leçons). Le plan gratuit offre 10 GB et,
 * surtout, aucun frais de sortie (egress) : le streaming vers les élèves
 * ne coûte rien.
 *
 * Les fichiers ne transitent PAS par le serveur Next.js : le client obtient
 * une URL signée (PUT) via /api/media puis téléverse directement vers R2.
 * La lecture se fait par l'URL publique du bucket (R2_PUBLIC_BASE_URL).
 *
 * Variables d'environnement (voir DEPLOYMENT.md) :
 *  - R2_ACCOUNT_ID          id du compte Cloudflare
 *  - R2_ACCESS_KEY_ID       clé API R2 (token "Object Read & Write")
 *  - R2_SECRET_ACCESS_KEY   secret associé
 *  - R2_BUCKET              nom du bucket (ex. monte-et-souris-media)
 *  - R2_PUBLIC_BASE_URL     domaine public du bucket, sans slash final
 *                           (ex. https://pub-xxxx.r2.dev ou domaine custom)
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialisation paresseuse : les variables ne sont disponibles qu'à
// l'exécution, pas au build (même contrainte que supabaseAdmin).
let client: S3Client | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquante`);
  return v;
}

function r2Client(): S3Client {
  return (client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  }));
}

export const UPLOAD_URL_TTL_SECONDS = 600; // 10 minutes

/**
 * URL signée pour téléverser `key` directement vers R2 en PUT.
 * Le Content-Type et la taille sont fixés dans la signature : le client
 * ne peut pas envoyer autre chose que ce que la route /api/media a validé.
 */
export async function presignUpload(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2Client(), cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/** URL publique (lecture) d'un objet du bucket. */
export function publicUrl(key: string): string {
  return `${env("R2_PUBLIC_BASE_URL")}/${key}`;
}
