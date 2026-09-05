import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { analyseWeakSpots } from "@/lib/weakSpots";
import { generatePracticeSet, PracticeConfigError, PracticeGenerationError } from "@/lib/practiceGenerator";
import { toReplayBlocks, toPracticeSources, type PracticeBlock, type PracticeSet, type PracticeSource } from "@/lib/practice";
import type { ContentBlock } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "@/lib/exerciseEvents";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(COOKIE_NAME)?.value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Délai minimal entre deux générations Claude pour un même élève et une même leçon. */
const MIN_INTERVAL_MS = 60_000;

/**
 * Mode de révision (variable PRACTICE_MODE) :
 *  - "replay" (défaut) : rejoue les exercices ratés d'origine, sans appel API.
 *  - "claude"          : génère des variantes avec Claude (ANTHROPIC_API_KEY requise).
 */
type PracticeMode = "replay" | "claude";
const practiceMode = (): PracticeMode => (process.env.PRACTICE_MODE === "claude" ? "claude" : "replay");
/** Valeur de la colonne `model` pour une série rejouée sans agent. */
const REPLAY_MODEL = "replay";
/** Événements lus pour l'analyse (les plus récents). */
const EVENTS_LIMIT = 2000;

interface PracticeRow {
  id: string;
  user_id: string;
  lesson_id: string;
  blocks: PracticeBlock[];
  sources: PracticeSource[];
  model: string | null;
  created_at: string;
}

function rowToSet(row: PracticeRow): PracticeSet {
  return { id: row.id, lessonId: row.lesson_id, createdAt: row.created_at, blocks: row.blocks ?? [], sources: row.sources ?? [] };
}

/**
 * GET /api/practice?lessonId=&userId=
 * Dernière série de révision pour une leçon. Élèves : la leur uniquement ;
 * enseignants / admins : celle de l'élève indiqué par userId.
 * Réponse : la série, ou null s'il n'y en a pas encore.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lessonId");
  const userId   = searchParams.get("userId");
  if (!lessonId || !UUID_RE.test(lessonId)) return NextResponse.json({ error: "lessonId invalide" }, { status: 400 });

  if (session.role === "student" && userId && userId !== session.id) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const effectiveUserId = session.role === "student" ? session.id : userId;
  if (!effectiveUserId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

  const { data, error } = await supabase()
    .from("practice_sets")
    .select("*")
    .eq("user_id", effectiveUserId)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ? rowToSet(data as PracticeRow) : null);
}

/**
 * POST /api/practice  { lessonId }
 * Analyse les événements de l'élève sur la leçon, construit une série de
 * révision ciblée (mode replay ou claude) et l'enregistre. Réservé aux élèves.
 *
 * Réponses :
 *  201 { status: "created", set }        série prête
 *  200 { status: "nothing_to_review" }   aucun exercice raté
 *  200 { status: "empty" }               rien d'exploitable (mode claude)
 *  429                                   génération trop récente (mode claude)
 *  503                                   agent non configuré (mode claude)
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "student") {
    return NextResponse.json({ error: "Seuls les élèves génèrent des révisions" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const lessonId = body?.lessonId;
  if (typeof lessonId !== "string" || !UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: "lessonId invalide" }, { status: 400 });
  }

  const db = supabase();
  const mode = practiceMode();

  if (mode === "claude") {
    const { data: latest } = await db
      .from("practice_sets")
      .select("created_at")
      .eq("user_id", session.id)
      .eq("lesson_id", lessonId)
      .neq("model", REPLAY_MODEL)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && Date.now() - new Date(latest.created_at).getTime() < MIN_INTERVAL_MS) {
      return NextResponse.json({ error: "Une série vient d'être générée, réessaie dans une minute" }, { status: 429 });
    }
  }

  const { data: lesson, error: lessonError } = await db
    .from("lessons")
    .select("id, title, exercises")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 });
  if (!lesson) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });

  const blocks = ((lesson.exercises as { blocks?: ContentBlock[] } | null)?.blocks ?? []);

  const { data: events, error: eventsError } = await db
    .from("exercise_events")
    .select("*")
    .eq("user_id", session.id)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .limit(EVENTS_LIMIT);
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const weakSpots = analyseWeakSpots(blocks, (events ?? []) as ExerciseEventRow[]);
  if (weakSpots.length === 0) return NextResponse.json({ status: "nothing_to_review" });

  let result: { blocks: PracticeBlock[]; sources: PracticeSource[]; model: string; usage: { input_tokens: number | null; output_tokens: number | null } };
  if (mode === "replay") {
    result = {
      blocks: toReplayBlocks(weakSpots),
      sources: toPracticeSources(weakSpots),
      model: REPLAY_MODEL,
      usage: { input_tokens: null, output_tokens: null },
    };
  } else try {
    result = await generatePracticeSet({ lessonTitle: lesson.title, weakSpots });
  } catch (err) {
    if (err instanceof PracticeConfigError) {
      return NextResponse.json({ error: "L'agent de révision n'est pas configuré" }, { status: 503 });
    }
    if (err instanceof PracticeGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "L'agent est très sollicité, réessaie dans un instant" }, { status: 503 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[practice] clé API Anthropic refusée");
      return NextResponse.json({ error: "L'agent de révision n'est pas configuré" }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[practice] erreur API ${err.status}:`, err.message);
      return NextResponse.json({ error: "L'agent de révision est indisponible" }, { status: 502 });
    }
    throw err;
  }

  if (result.blocks.length === 0) return NextResponse.json({ status: "empty" });

  const { data: inserted, error: insertError } = await db
    .from("practice_sets")
    .insert({
      user_id: session.id,
      lesson_id: lessonId,
      blocks: result.blocks,
      sources: result.sources,
      model: result.model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ status: "created", set: rowToSet(inserted as PracticeRow) }, { status: 201 });
}
