/**
 * Vidéo d'introduction d'une leçon, puis son diaporama de cours en direct.
 * Depuis l'éditeur, l'enseignant demande la vidéo : elle est rendue par le
 * projet Remotion (animations/recap.mjs) et placée en tête de la leçon ; le
 * diaporama est alors construit à partir du même contenu (src/lib/liveDeck)
 * et enregistré avec la leçon, prêt à être lancé en direct.
 *
 * La vidéo est identifiée par l'empreinte de son contenu : redemander la
 * vidéo d'une leçon inchangée ne refait rien ; si la leçon a changé, la
 * nouvelle vidéo et le nouveau diaporama remplacent les anciens. Le rendu
 * demande Chrome et ffmpeg (fournis par Remotion) : en ligne, il est confié
 * à GitHub Actions (voir requestRecap).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";
import { presignUpload, publicUrl } from "@/lib/r2";
import { charterColor } from "@/lib/presentation";
import { buildLessonDeck, lessonParts, recapProps, type LessonPart, type SavedDeck } from "@/lib/liveDeck";

type Block = { id?: string; type?: string; recap?: boolean };
type Exercises = { blocks?: Block[]; live?: SavedDeck };

export interface RecapRequest { lessonId: string }

const COMPOSITION = "recap-lecon";
const ANIMATIONS_DIR = path.join(process.cwd(), "animations");

/** À augmenter quand les animations changent : les vidéos déjà placées seront refaites. */
const RECAP_VERSION = 6;

/** Rendus en cours, pour ne pas lancer deux fois la même vidéo. */
const running = new Set<string>();

function fingerprint(props: unknown): string {
  return createHash("sha1").update(RECAP_VERSION + COMPOSITION + JSON.stringify(props)).digest("hex").slice(0, 16);
}

function render(props: unknown, output: string): Promise<void> {
  return (async () => {
    const propsFile = path.join(os.tmpdir(), `${path.basename(output)}.json`);
    await fs.writeFile(propsFile, JSON.stringify(props));
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ["recap.mjs", COMPOSITION, propsFile, output], { cwd: ANIMATIONS_DIR, stdio: ["ignore", "ignore", "pipe"] });
        let errors = "";
        child.stderr.on("data", (chunk) => { errors += chunk; });
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Rendu ${COMPOSITION} échoué (${code}) : ${errors.slice(-800)}`))));
      });
    } finally {
      await fs.rm(propsFile, { force: true });
    }
  })();
}

/**
 * Dépose la vidéo sur R2 et renvoie son URL publique. Sans R2 configuré
 * (développement local), elle est servie depuis public/recaps.
 */
async function store(file: string, key: string): Promise<string> {
  const data = await fs.readFile(file);
  if (!process.env.R2_BUCKET) {
    if (process.env.CI) throw new Error("R2 non configuré : la vidéo ne serait visible nulle part");
    const dir = path.join(process.cwd(), "public", "recaps");
    await fs.mkdir(dir, { recursive: true });
    await fs.copyFile(file, path.join(dir, `${key}.mp4`));
    return `/recaps/${key}.mp4`;
  }
  const objectKey = `recaps/${key}.mp4`;
  const res = await fetch(presignUpload(objectKey, "video/mp4", data.length), {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(data.length) },
    body: data,
  });
  if (!res.ok) throw new Error(`Téléversement R2 échoué (${res.status})`);
  return publicUrl(objectKey);
}

export interface RecapPlan {
  lessonId: string;
  parts: LessonPart[];
  props: ReturnType<typeof recapProps>;
  key: string;
}

/**
 * Ce que la vidéo de la leçon doit montrer, ou `null` si la leçon a déjà
 * cette vidéo et son diaporama. Lève une erreur si la leçon n'a ni bloc
 * « Lettres » complet ni assez de vocabulaire.
 */
export async function planRecap(request: RecapRequest): Promise<RecapPlan | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("lessons").select("id, title, exercises").eq("id", request.lessonId).single();
  if (error || !data) throw new Error(`Leçon ${request.lessonId} introuvable`);
  // Même couleur qu'en séance jusqu'ici : celle du rang de la leçon dans la liste.
  const { data: ids } = await db.from("lessons").select("id").order("created_at", { ascending: false });
  const rank = Math.max(0, (ids ?? []).findIndex((l) => l.id === data.id));
  const exercises = (data.exercises ?? {}) as Exercises;

  const parts = lessonParts(data.title, exercises.blocks ?? [], charterColor(rank));
  if (parts.length === 0) throw new Error("La leçon n'a ni lettres ni assez de vocabulaire pour une vidéo");
  const props = recapProps(parts);
  const key = fingerprint(props);
  if (exercises.live?.key === key) return null;
  return { lessonId: data.id, parts, props, key };
}

/**
 * Place la vidéo en tête de la leçon et enregistre le diaporama tiré des
 * mêmes parties. La leçon est relue au dernier moment : l'enseignant a pu la
 * modifier pendant le rendu.
 */
async function saveRecap(plan: RecapPlan, videoUrl: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db.from("lessons").select("exercises").eq("id", plan.lessonId).single();
  const exercises = (data?.exercises ?? {}) as Exercises;
  const blocks = [
    { id: `recap-${plan.key}`, type: "video", url: videoUrl, title: "", recap: true },
    ...(exercises.blocks ?? []).filter((b) => !b.recap),
  ];
  const live: SavedDeck = { key: plan.key, slides: buildLessonDeck(plan.parts), videoUrl, createdAt: new Date().toISOString() };
  const { error } = await db.from("lessons").update({ exercises: { ...exercises, blocks, live } }).eq("id", plan.lessonId);
  if (error) throw new Error(error.message);
}

/** Rend la vidéo d'une leçon, la place en tête et enregistre son diaporama. */
export async function makeRecap(request: RecapRequest): Promise<void> {
  const plan = await planRecap(request);
  if (!plan || running.has(plan.key)) return;
  running.add(plan.key);

  const output = path.join(os.tmpdir(), `recap-${plan.key}.mp4`);
  try {
    await render(plan.props, output);
    await saveRecap(plan, await store(output, plan.key));
  } finally {
    running.delete(plan.key);
    await fs.rm(output, { force: true });
  }
}

/**
 * Demande la vidéo d'une leçon. Si GitHub est configuré (GITHUB_RECAP_TOKEN,
 * GITHUB_RECAP_REPO), le rendu est confié au workflow
 * .github/workflows/recap.yml — l'hébergeur du site n'a pas Chrome ; sinon il
 * se fait ici, en arrière-plan (développement local). Renvoie `false` si la
 * leçon a déjà cette vidéo et son diaporama.
 */
export async function requestRecap(request: RecapRequest): Promise<boolean> {
  const plan = await planRecap(request);
  if (!plan) return false;

  const token = process.env.GITHUB_RECAP_TOKEN?.trim();
  const repo = process.env.GITHUB_RECAP_REPO?.trim();
  if (!token || !repo) {
    makeRecap(request).catch((e) => console.error("[recap]", e));
    return true;
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/recap.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { request: JSON.stringify(request), key: plan.key } }),
  });
  if (!res.ok) throw new Error(`Workflow recap non lancé (${res.status}) : ${await res.text()}`);
  return true;
}
