/**
 * Migration ponctuelle : convertit en MP3 les audios de leçon stockés sur R2
 * au format WebM/Opus (illisible sur Safari, iPhone et iPad).
 *
 * Pour chaque leçon, chaque URL https://…/*.webm portée par un champ audio
 * (audioDataUrl, answerAudioDataUrl) est téléchargée, convertie avec ffmpeg
 * (mono, 24 kHz, 48 kbps), téléversée sur R2 sous une nouvelle clé, puis la
 * leçon est mise à jour. Les anciens fichiers WebM ne sont pas supprimés.
 *
 * Prérequis : ffmpeg dans le PATH, et dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
 *
 * Usage :  node scripts/migrate-audio-to-mp3.ts            (simulation)
 *          node scripts/migrate-audio-to-mp3.ts --apply    (écrit en base)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { presignUpload, publicUrl } from "../src/lib/r2.ts";

// Charge .env.local dans process.env (sans dépendance dotenv)
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  if (!(k in process.env)) process.env[k] = v;
}

const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

const AUDIO_KEYS = new Set(["audioDataUrl", "answerAudioDataUrl"]);
const isWebmAudioUrl = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith("https://") && /\.webm$/i.test(v);

interface LessonRow { id: string; title: string; exercises: unknown }

async function convertToMp3(webmUrl: string, workdir: string): Promise<Buffer> {
  const src = join(workdir, "in.webm");
  const dst = join(workdir, "out.mp3");
  const res = await fetch(webmUrl);
  if (!res.ok) throw new Error(`téléchargement ${res.status} : ${webmUrl}`);
  writeFileSync(src, Buffer.from(await res.arrayBuffer()));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "24000", "-b:a", "48k", dst]);
  return readFileSync(dst);
}

async function uploadMp3(data: Buffer): Promise<string> {
  const key = `media/${new Date().getFullYear()}/${crypto.randomUUID()}-media.mp3`;
  const url = presignUpload(key, "audio/mpeg", data.length);
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "audio/mpeg" }, body: data });
  if (!res.ok) throw new Error(`R2 a refusé le fichier (${res.status})`);
  return publicUrl(key);
}

/** Remplace récursivement les audios WebM ; retourne le nombre de conversions. */
async function migrate(value: unknown, workdir: string, stats: { converted: number }): Promise<unknown> {
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await migrate(v, workdir, stats));
    return out;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (AUDIO_KEYS.has(k) && isWebmAudioUrl(v)) {
        console.log(`   ${k}: ${v.slice(-40)}`);
        if (APPLY) {
          const mp3 = await convertToMp3(v, workdir);
          out[k] = await uploadMp3(mp3);
          console.log(`     → ${String(out[k]).slice(-40)} (${Math.round(mp3.length / 1024)} Ko)`);
        } else {
          out[k] = v;
        }
        stats.converted++;
      } else {
        out[k] = await migrate(v, workdir, stats);
      }
    }
    return out;
  }
  return value;
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lessons?select=id,title,exercises`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const lessons = (await res.json()) as LessonRow[];
  console.log(`${lessons.length} leçon(s) — mode ${APPLY ? "APPLICATION" : "simulation (ajoutez --apply)"}`);

  const workdir = mkdtempSync(join(tmpdir(), "ms-audio-"));
  let total = 0;
  try {
    for (const lesson of lessons) {
      const stats = { converted: 0 };
      console.log(`\n• ${lesson.title} (${lesson.id})`);
      const exercises = await migrate(lesson.exercises, workdir, stats);
      if (stats.converted === 0) { console.log("   aucun audio WebM"); continue; }
      total += stats.converted;
      if (!APPLY) continue;
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/lessons?id=eq.${lesson.id}`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ exercises }),
      });
      if (!patch.ok) throw new Error(`mise à jour leçon ${lesson.id} : ${patch.status} ${await patch.text()}`);
      console.log(`   leçon mise à jour (${stats.converted} audio(s))`);
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
  console.log(`\n${total} audio(s) ${APPLY ? "converti(s)" : "à convertir"}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
