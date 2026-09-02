/**
 * Téléversement d'un média vers Cloudflare R2 depuis le navigateur.
 *
 * 1. POST /api/media (session enseignant requise) → URL signée + URL publique
 * 2. PUT du fichier directement vers R2 — il ne transite pas par le serveur.
 *
 * XMLHttpRequest plutôt que fetch : nécessaire pour la progression d'envoi.
 * Retourne l'URL publique à enregistrer dans la leçon.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
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
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3",
  "video/mp4": "mp4", "video/webm": "webm",
};

/**
 * Parcourt récursivement une structure de leçon et téléverse vers R2 tout
 * média encore inline (chaînes data: ou blob: — images des diapos/quiz,
 * audios enregistrés). Chaque média est remplacé par son URL publique, si
 * bien que la leçon peut être stockée en base sans binaire. Les URLs https
 * déjà externalisées sont laissées telles quelles. Un blob: périmé (page
 * rechargée depuis) est remplacé par undefined : l'enseignant re-téléverse.
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
    const ext = EXT_BY_MIME[blob.type] ?? "bin";
    const file = new File([blob], `media.${ext}`, { type: blob.type });
    return uploadMedia(file);
  }
  return value;
}
