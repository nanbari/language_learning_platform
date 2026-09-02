import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { presignUpload, publicUrl, UPLOAD_URL_TTL_SECONDS } from "@/lib/r2";

// Téléversement de médias (vidéos, audios, images) vers Cloudflare R2.
// Le serveur ne reçoit jamais le fichier : il valide la demande, signe une
// URL PUT limitée (type + taille verrouillés dans la signature) et le
// navigateur téléverse directement vers R2.

const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_TYPES = /^(video|audio|image)\//;

// Garde le nom lisible dans la clé mais neutralise tout caractère spécial
// (les clés servent d'URL publiques).
function sanitize(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "fichier";
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "teacher" && session.role !== "admin") {
    return NextResponse.json({ error: "Seuls les enseignants peuvent téléverser des médias" }, { status: 403 });
  }

  let body: { filename?: string; contentType?: string; size?: number } = {};
  try { body = await req.json(); } catch { /* corps invalide → validations ci-dessous */ }
  const filename = String(body.filename ?? "");
  const contentType = String(body.contentType ?? "");
  const size = Number(body.size ?? 0);

  if (!filename || !ALLOWED_TYPES.test(contentType)) {
    return NextResponse.json({ error: "Type de fichier non autorisé (vidéo, audio ou image)" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Taille invalide (max 200 MB)" }, { status: 400 });
  }

  const key = `media/${new Date().getFullYear()}/${crypto.randomUUID()}-${sanitize(filename)}`;
  const uploadUrl = await presignUpload(key, contentType, size);

  return NextResponse.json({
    uploadUrl,               // PUT le fichier ici (header Content-Type identique)
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    key,
    publicUrl: publicUrl(key), // URL à enregistrer dans la leçon
  });
}
