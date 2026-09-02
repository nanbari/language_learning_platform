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
