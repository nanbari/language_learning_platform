/**
 * Conversion d'un enregistrement vocal en MP3, dans le navigateur.
 *
 * MediaRecorder produit du WebM/Opus sur Chrome et Firefox, du MP4/AAC sur
 * Safari : aucun des deux n'est lu partout (Safari ignore WebM). Le MP3,
 * lui, est lu par tous les navigateurs. On décode donc l'enregistrement avec
 * l'API Web Audio, on le ramène en mono 24 kHz (suffisant pour la voix) et on
 * l'encode avec lamejs, à 48 kbps.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

export const MP3_SAMPLE_RATE = 24_000;
export const MP3_KBPS = 48;
const CHUNK = 1152; // taille de trame MP3

/** Vrai pour un audio qui n'est pas déjà du MP3 (à convertir avant envoi). */
export function needsMp3Transcode(mimeType: string): boolean {
  return mimeType.startsWith("audio/") && mimeType !== "audio/mpeg" && mimeType !== "audio/mp3";
}

async function decodeToMono(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  // Un AudioContext temporaire sert uniquement au décodage
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try { decoded = await ctx.decodeAudioData(bytes); }
  finally { await ctx.close(); }

  // Rééchantillonnage + mixage mono via un contexte hors-ligne
  const length = Math.ceil(decoded.duration * MP3_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, length, MP3_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Encode des échantillons PCM mono 16 bits (à MP3_SAMPLE_RATE) en MP3. */
export function encodePcmToMp3(pcm: Int16Array): Uint8Array[] {
  const encoder = new Mp3Encoder(1, MP3_SAMPLE_RATE, MP3_KBPS);
  // lamejs renvoie en réalité des Int8Array malgré ses typages : on
  // réinterprète les mêmes octets en non signé.
  const bytes = (a: ArrayBufferView) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += CHUNK) {
    const frame = encoder.encodeBuffer(pcm.subarray(i, i + CHUNK));
    if (frame.length > 0) parts.push(bytes(frame));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(bytes(tail));
  return parts;
}

/** Convertit un enregistrement (WebM, OGG, MP4…) en Blob MP3 mono. */
export async function transcodeToMp3(blob: Blob): Promise<Blob> {
  const pcm = floatToInt16(await decodeToMono(blob));
  return new Blob(encodePcmToMp3(pcm) as BlobPart[], { type: "audio/mpeg" });
}
