/**
 * Téléversement d'un média vers Cloudflare R2 depuis le navigateur.
 *
 * 1. POST /api/media (session enseignant requise) → URL signée + URL publique
 * 2. PUT du fichier directement vers R2 — il ne transite pas par le serveur.
 *
 * XMLHttpRequest plutôt que fetch : nécessaire pour la progression d'envoi.
 * Retourne l'URL publique à enregistrer dans la leçon.
 */
import { needsMp3Transcode, transcodeToMp3 } from "@/lib/audioTranscode";

/** Au-delà de ce côté, une photo est réduite avant l'envoi : l'écran d'un élève n'en affiche jamais plus. */
const MAX_IMAGE_SIDE = 1600;
const SHRINK_ABOVE_BYTES = 400 * 1024;

/**
 * Réduit une photo d'appareil (souvent 3 à 6 Mo, 4000 px) à 1600 px de côté
 * au plus, en WebP ou JPEG à 82 %. Les GIF, les SVG et les petites images
 * passent tels quels ; en cas d'échec, l'original part sans perte.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size <= SHRINK_ABOVE_BYTES || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2 * SHRINK_ABOVE_BYTES) { bitmap.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === "image/png" ? "image/png" : "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/png" ? ".png" : ".webp");
    return new File([blob], name, { type: blob.type || type });
  } catch {
    return file;
  }
}

export async function uploadMedia(
  source: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const file = await shrinkImage(source);
  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Le stockage a refusé le fichier (${xhr.status})`));
    xhr.onerror = () => reject(new Error("téléversement interrompu, vérifiez la connexion"));
    xhr.send(file);
  });

  return publicUrl;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
  "video/mp4": "mp4", "video/webm": "webm",
};

/**
 * Parcourt récursivement une structure de leçon et téléverse vers R2 tout
 * média encore inline (chaînes data: ou blob: — images des diapos/quiz,
 * audios enregistrés). Chaque média est remplacé par son URL publique, si
 * bien que la leçon peut être stockée en base sans binaire. Les URLs https
 * déjà externalisées sont laissées telles quelles. Un blob: périmé (page
 * rechargée depuis) est remplacé par undefined : l'enseignant re-téléverse.
 *
 * Les audios enregistrés (WebM/Opus sur Chrome, MP4 sur Safari) sont
 * convertis en MP3 avant envoi : c'est le seul format lu par tous les
 * navigateurs, iPhone et iPad compris. Si la conversion échoue, le fichier
 * d'origine est envoyé tel quel plutôt que de perdre l'enregistrement.
 */
export async function externalizeMediaToR2(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(externalizeMediaToR2));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await externalizeMediaToR2(v);
    return out;
  }
  if (typeof value === "string" && (value.startsWith("data:") || value.startsWith("blob:"))) {
    let blob: Blob;
    try { blob = await fetch(value).then((r) => r.blob()); }
    catch { return undefined; }
    if (needsMp3Transcode(blob.type)) {
      try { blob = await transcodeToMp3(blob); }
      catch (e) { console.warn("Conversion MP3 impossible, envoi du format d'origine", e); }
    }
    const ext = EXT_BY_MIME[blob.type] ?? "bin";
    const file = new File([blob], `media.${ext}`, { type: blob.type });
    return uploadMedia(file);
  }
  return value;
}
