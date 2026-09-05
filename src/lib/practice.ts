/**
 * Séries de révision — modèle partagé client / serveur.
 *
 * Une série (`practice_sets`) est une liste de blocs d'exercices proposés à
 * un élève pour une leçon, à partir de ses points faibles (voir weakSpots).
 * Deux modes (voir PRACTICE_MODE dans la route /api/practice) :
 *
 *  - replay (défaut, sans coût) : les exercices ratés d'origine sont rejoués
 *    tels quels, avec leur id d'origine. Leurs événements s'ajoutent donc à
 *    ceux de l'exercice : une réussite du premier coup en révision efface le
 *    point faible.
 *  - claude : l'agent génère des variantes (voir practiceGenerator). Les blocs
 *    générés ont un id préfixé `gen-` pour ne pas altérer l'analyse de
 *    l'exercice d'origine.
 *
 * Ce module ne dépend pas du SDK Anthropic : la conversion de la sortie du
 * modèle en blocs (avec validation) est pure et testée à part.
 */
import { z } from "zod";
import type { ContentBlock, QuizExercise, WordOrderExercise } from "@/components/lesson/ExerciseRenderers";
import type { ReviewableExercise, WeakSpot } from "./weakSpots";

/** Préfixe des blocs générés (block_id dans exercise_events). */
export const GENERATED_PREFIX = "gen-";
/** Nombre d'exercices produits par point faible. */
export const VARIANTS_PER_SPOT = 2;
/** Nombre maximal de points faibles traités par série générée (coût API). */
export const MAX_SPOTS_PER_SET = 4;
/** Nombre maximal d'exercices rejoués par série (mode replay, sans coût). */
export const MAX_REPLAY_PER_SET = 10;
/** Options attendues pour un quiz généré. */
export const QUIZ_OPTIONS = 3;

/*
 * Schéma de sortie du modèle. Volontairement sans contraintes minItems /
 * maxItems / minLength : la sortie structurée garantit la forme, la
 * validation fine est faite dans toPracticeBlocks.
 */
export const GeneratedQuizSchema = z.object({
  type: z.literal("quiz"),
  sourceBlockId: z.string().describe("blockId du point faible dont cet exercice est la variante"),
  question: z.string(),
  options: z.array(z.string()).describe(`Exactement ${QUIZ_OPTIONS} réponses possibles, une seule correcte`),
  correctIndex: z.number().int().describe("Index (0-based) de la bonne réponse dans options"),
});

export const GeneratedWordOrderSchema = z.object({
  type: z.literal("wordorder"),
  sourceBlockId: z.string().describe("blockId du point faible dont cet exercice est la variante"),
  sentence: z.string().describe("Phrase correcte, mots séparés par des espaces (3 à 7 mots)"),
});

export const GeneratedSetSchema = z.object({
  exercises: z.array(z.union([GeneratedQuizSchema, GeneratedWordOrderSchema])),
});

export type GeneratedSet = z.infer<typeof GeneratedSetSchema>;
export type GeneratedExercise = GeneratedSet["exercises"][number];

/** Bloc d'exercice tel que stocké dans une série (sous-ensemble de ContentBlock). */
export type PracticeBlock = Extract<ContentBlock, { type: "exercise" }>;

export interface PracticeSet {
  id: string;
  lessonId: string;
  createdAt: string;
  blocks: PracticeBlock[];
  /** Points faibles à l'origine de la série (pour l'affichage et l'enseignant). */
  sources: PracticeSource[];
}

export interface PracticeSource {
  blockId: string;
  type: ReviewableExercise["type"];
  /** Libellé court de l'exercice d'origine (question ou phrase). */
  label: string;
  wrongAttempts: number;
  wrongAnswers: string[];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mode replay : rejoue les exercices ratés d'origine, du plus fragile au
 * moins fragile. L'id du bloc est conservé (voir en-tête). Les réponses des
 * quiz sont mélangées pour éviter la mémorisation de la position.
 */
export function toReplayBlocks(spots: WeakSpot[]): PracticeBlock[] {
  return spots.slice(0, MAX_REPLAY_PER_SET).map((spot) => {
    const ex = spot.exercise;
    const exercise: ReviewableExercise =
      ex.type === "quiz" ? { ...ex, options: shuffle(ex.options) } : { ...ex };
    return { id: spot.blockId, type: "exercise", exercise };
  });
}

/** Points faibles à l'origine d'une série, pour l'affichage et l'enseignant. */
export function toPracticeSources(spots: WeakSpot[]): PracticeSource[] {
  return spots.map((s) => ({
    blockId: s.blockId,
    type: s.exercise.type,
    label: exerciseLabel(s.exercise),
    wrongAttempts: s.wrongAttempts,
    wrongAnswers: s.wrongAnswers,
  }));
}

const normalise = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Convertit la sortie du modèle en blocs prêts à être joués. Les exercices
 * invalides (mauvais index, doublon d'options, copie de l'original, source
 * inconnue…) sont ignorés silencieusement : mieux vaut une série plus
 * courte qu'un exercice cassé devant un enfant.
 */
export function toPracticeBlocks(
  generated: GeneratedSet,
  sources: Map<string, ReviewableExercise>,
): PracticeBlock[] {
  const blocks: PracticeBlock[] = [];
  const seen = new Set<string>();

  for (const g of generated.exercises) {
    const source = sources.get(g.sourceBlockId);
    if (!source) continue;

    if (g.type === "quiz") {
      if (source.type !== "quiz") continue;
      const question = g.question.trim();
      const options  = g.options.map((o) => o.trim()).filter(Boolean);
      if (!question || options.length !== QUIZ_OPTIONS) continue;
      if (!Number.isInteger(g.correctIndex) || g.correctIndex < 0 || g.correctIndex >= options.length) continue;
      if (new Set(options.map(normalise)).size !== options.length) continue;
      if (normalise(question) === normalise(source.question)) continue;
      const key = `q:${normalise(question)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const withIds = options.map((text) => ({ id: uid(), text }));
      const exercise: QuizExercise = {
        type: "quiz",
        question,
        options: withIds,
        correctId: withIds[g.correctIndex].id,
        answerMode: "text",
      };
      blocks.push({ id: `${GENERATED_PREFIX}${uid()}`, type: "exercise", exercise });
      continue;
    }

    if (g.type === "wordorder") {
      if (source.type !== "wordorder") continue;
      const sentence = g.sentence.trim().replace(/\s+/g, " ");
      const words = sentence.split(" ").filter(Boolean);
      if (words.length < 2 || words.length > 10) continue;
      if (normalise(sentence) === normalise(source.sentence)) continue;
      const key = `w:${normalise(sentence)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const exercise: WordOrderExercise = { type: "wordorder", sentence };
      blocks.push({ id: `${GENERATED_PREFIX}${uid()}`, type: "exercise", exercise });
    }
  }

  return blocks;
}

/** Libellé court d'un exercice d'origine. */
export function exerciseLabel(ex: ReviewableExercise): string {
  return ex.type === "quiz" ? ex.question : ex.sentence;
}
