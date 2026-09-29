/**
 * Vidéos récapitulatives des cours en direct. Quand un enseignant lance un
 * cours, chaque partie (lettres, vocabulaire) donne une vidéo, rendue par le
 * projet Remotion (animations/recap.mjs) et placée en tête de la leçon
 * correspondante, où l'élève la voit en premier.
 *
 *  - lettres : la leçon « Lettres ب ت ث » (ou « Lettre ب » au niveau avancé),
 *    créée si elle n'existe pas ;
 *  - vocabulaire : la leçon présentée.
 *
 * Une vidéo est identifiée par l'empreinte de son contenu : relancer le même
 * cours ne refait rien ; si la leçon a changé, la nouvelle vidéo remplace
 * l'ancienne. Le rendu demande Chrome et ffmpeg (fournis par Remotion) : en
 * ligne, il est confié à GitHub Actions (voir requestRecap).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";
import { presignUpload, publicUrl } from "@/lib/r2";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LETTER_STROKES } from "@/data/letterStrokes";
import { clipRank, clipsFor } from "@/data/animations";
import { charterColor, lessonVocabWords, letterColor } from "@/lib/presentation";

type Block = { id?: string; type?: string; recap?: boolean };
type Composition = "recap-lettres" | "recap-vocabulaire";

export type RecapRequest =
  | { kind: "letters"; letterIds: number[] }
  | { kind: "vocab"; lessonId: string };

const ANIMATIONS_DIR = path.join(process.cwd(), "animations");
// L'éditeur ne demande ni matière ni tranche d'âge — la base les exige (voir lessonsApi).
const DEFAULT_SUBJECT = "général";
const DEFAULT_AGE_GROUP = "tous";

/** Rendus en cours, pour ne pas lancer deux fois la même vidéo. */
const running = new Set<string>();

function lettersProps(letterIds: number[]) {
  const letters = letterIds
    .map((id) => ARABIC_ALPHABET.find((l) => l.id === id))
    .filter((l) => l !== undefined)
    .flatMap((letter) => {
      const glyph = LETTER_STROKES[letter.isolated];
      if (!glyph) return [];
      return [{
        char: letter.isolated,
        color: letterColor(letter),
        outline: glyph.outline,
        strokes: glyph.strokes.map(({ d, width }) => ({ d, width })),
        marks: glyph.marks,
      }];
    });
  return { letters };
}

/** Mots dans l'ordre de la séance : la couverture, les mots animés dans leur ordre fixe, puis les autres. */
function vocabProps(title: string, blocks: unknown[], color: string) {
  const [cover, ...rest] = lessonVocabWords(blocks);
  const ranked = rest.filter((w) => clipRank(w.imageUrl) !== undefined).sort((a, b) => clipRank(a.imageUrl)! - clipRank(b.imageUrl)!);
  const others = rest.filter((w) => clipRank(w.imageUrl) === undefined);
  const words = (cover ? [cover, ...ranked, ...others] : []).map((w) => {
    const clip = clipsFor(w.imageUrl)[0];
    return { imageUrl: w.imageUrl, arabic: w.arabic, ...(clip && { clip: clip.src.replace(/^\//, "") }) };
  });
  // Le titre n'est écrit que s'il est en arabe (aucun texte français). `null`
  // explicite : sinon Remotion garderait le titre de l'exemple (defaultProps).
  return { title: /[؀-ۿ]/.test(title) ? title : null, color, words };
}

/** À augmenter quand les animations changent : les vidéos déjà placées seront refaites. */
const RECAP_VERSION = 5;

function fingerprint(composition: Composition, props: unknown): string {
  return createHash("sha1").update(RECAP_VERSION + composition + JSON.stringify(props)).digest("hex").slice(0, 16);
}

function render(composition: Composition, props: unknown, output: string): Promise<void> {
  return (async () => {
    const propsFile = path.join(os.tmpdir(), `${path.basename(output)}.json`);
    await fs.writeFile(propsFile, JSON.stringify(props));
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ["recap.mjs", composition, propsFile, output], { cwd: ANIMATIONS_DIR, stdio: ["ignore", "ignore", "pipe"] });
        let errors = "";
        child.stderr.on("data", (chunk) => { errors += chunk; });
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Rendu ${composition} échoué (${code}) : ${errors.slice(-800)}`))));
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

/** La vidéo récapitulative en tête de la leçon, à la place de la précédente. */
function withRecap(blocks: Block[], key: string, url: string): Block[] {
  return [{ id: `recap-${key}`, type: "video", url, title: "", recap: true } as Block, ...blocks.filter((b) => !b.recap)];
}

interface RecapPlan {
  composition: Composition;
  props: unknown;
  key: string;
  /** Titre de la leçon ; pour les lettres, elle est retrouvée (ou créée) par ce titre. */
  title: string;
  lessonId: string | null;
}

/** Ce que la vidéo d'une partie du cours doit montrer, ou `null` si sa leçon l'a déjà. */
export async function planRecap(request: RecapRequest): Promise<RecapPlan | null> {
  const db = supabaseAdmin();
  let composition: Composition;
  let props: unknown;
  let lesson: { id: string; blocks: Block[] } | null;
  let title: string;

  if (request.kind === "vocab") {
    const { data, error } = await db.from("lessons").select("id, title, exercises").eq("id", request.lessonId).single();
    if (error || !data) throw new Error(`Leçon ${request.lessonId} introuvable`);
    // Même couleur qu'en séance : celle du rang de la leçon dans la liste.
    const { data: ids } = await db.from("lessons").select("id").order("created_at", { ascending: false });
    const rank = Math.max(0, (ids ?? []).findIndex((l) => l.id === data.id));
    const blocks = (data.exercises?.blocks ?? []) as Block[];
    composition = "recap-vocabulaire";
    props = vocabProps(data.title, blocks, charterColor(rank));
    lesson = { id: data.id, blocks };
    title = data.title;
  } else {
    title = lettersTitle(request.letterIds);
    const { data } = await db.from("lessons").select("id, exercises").eq("title", title).limit(1).maybeSingle();
    composition = "recap-lettres";
    props = lettersProps(request.letterIds);
    lesson = data ? { id: data.id, blocks: (data.exercises?.blocks ?? []) as Block[] } : null;
  }

  const key = fingerprint(composition, props);
  if (lesson?.blocks.some((b) => b.id === `recap-${key}`)) return null;
  return { composition, props, key, title, lessonId: lesson?.id ?? null };
}

function lettersTitle(letterIds: number[]): string {
  const chars = letterIds.map((id) => ARABIC_ALPHABET.find((l) => l.id === id)?.isolated).filter(Boolean);
  return `${chars.length > 1 ? "Lettres" : "Lettre"} ${chars.join(" ")}`;
}

/** Place la vidéo en tête de la leçon, relue au dernier moment (l'enseignant a pu la modifier) ; crée la leçon de lettres au besoin. */
async function saveRecap(plan: RecapPlan, url: string, authorId: string): Promise<void> {
  const db = supabaseAdmin();
  const query = db.from("lessons").select("id, exercises");
  const { data: current } = await (plan.lessonId ? query.eq("id", plan.lessonId) : query.eq("title", plan.title)).limit(1).maybeSingle();
  if (current) {
    const exercises = current.exercises ?? {};
    const blocks = withRecap((exercises.blocks ?? []) as Block[], plan.key, url);
    const { error } = await db.from("lessons").update({ exercises: { ...exercises, blocks } }).eq("id", current.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("lessons").insert({
      title: plan.title,
      subject: DEFAULT_SUBJECT,
      age_group: DEFAULT_AGE_GROUP,
      author_id: authorId,
      exercises: { blocks: withRecap([], plan.key, url) },
      published_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

/** Rend la vidéo d'une partie du cours et la place dans sa leçon (créée au besoin). */
export async function makeRecap(request: RecapRequest, authorId: string): Promise<void> {
  const plan = await planRecap(request);
  if (!plan || running.has(plan.key)) return;
  running.add(plan.key);

  const output = path.join(os.tmpdir(), `recap-${plan.key}.mp4`);
  try {
    await render(plan.composition, plan.props, output);
    await saveRecap(plan, await store(output, plan.key), authorId);
  } finally {
    running.delete(plan.key);
    await fs.rm(output, { force: true });
  }
}

/**
 * Demande la vidéo au lancement d'un cours. Si GitHub est configuré
 * (GITHUB_RECAP_TOKEN, GITHUB_RECAP_REPO), le rendu est confié au workflow
 * .github/workflows/recap.yml — l'hébergeur du site n'a pas Chrome ; sinon
 * il se fait ici (développement local).
 */
export async function requestRecap(request: RecapRequest, authorId: string): Promise<void> {
  const token = process.env.GITHUB_RECAP_TOKEN;
  const repo = process.env.GITHUB_RECAP_REPO;
  if (!token || !repo) return makeRecap(request, authorId);

  const plan = await planRecap(request);
  if (!plan) return;
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/recap.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { request: JSON.stringify(request), author: authorId, key: plan.key } }),
  });
  if (!res.ok) throw new Error(`Workflow recap non lancé (${res.status}) : ${await res.text()}`);
}
