/**
 * Agent de génération d'exercices de révision — RÉSERVÉ AUX ROUTES SERVEUR.
 * Utilisé uniquement quand PRACTICE_MODE=claude (voir /api/practice) ; par
 * défaut, la révision rejoue les exercices d'origine sans appel API.
 *
 * Reçoit les points faibles d'un élève (weakSpots) et demande à Claude des
 * variantes de chaque exercice raté : même compétence, même langue, contenu
 * différent. La réponse est contrainte par un schéma (sortie structurée),
 * puis validée et convertie en blocs par toPracticeBlocks.
 *
 * Variables d'environnement : ANTHROPIC_API_KEY (obligatoire),
 * ANTHROPIC_MODEL (optionnel, défaut claude-opus-5).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  GeneratedSetSchema, toPracticeBlocks, toPracticeSources,
  MAX_SPOTS_PER_SET, VARIANTS_PER_SPOT, QUIZ_OPTIONS,
  type PracticeBlock, type PracticeSource,
} from "./practice";
import type { ReviewableExercise, WeakSpot } from "./weakSpots";

export const DEFAULT_MODEL = "claude-opus-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new PracticeConfigError("ANTHROPIC_API_KEY manquante");
  return (client ??= new Anthropic());
}

export class PracticeConfigError extends Error {}
export class PracticeGenerationError extends Error {}

// Prompt système stable (mis en cache côté API) : tout ce qui varie d'une
// requête à l'autre va dans le message utilisateur.
const SYSTEM_PROMPT = `Tu es l'assistant pédagogique de Monte & Souris, une ASBL qui crée des leçons interactives pour de jeunes enfants (école maternelle et primaire), souvent pour l'apprentissage de l'arabe et du français.

Un élève vient de rater certains exercices d'une leçon. Ta tâche : produire de nouveaux exercices de révision qui entraînent exactement la même compétence que chaque exercice raté, avec un contenu différent.

Règles :
- Chaque exercice généré est une variante d'un point faible donné : reprends son "blockId" dans "sourceBlockId" et garde le même "type".
- Même langue que l'exercice d'origine (si la question est en français et les réponses en arabe, fais pareil). Respecte l'orthographe et les diacritiques de la langue.
- Même compétence, même niveau de difficulté ou légèrement plus facile ; jamais plus difficile.
- Contenu vraiment différent de l'original (autre mot, autre phrase, autre exemple), mais dans le même thème.
- Formulations courtes, simples, positives, adaptées à un enfant de 4 à 10 ans. Pas de piège, pas de négation dans les questions.
- Quiz : exactement ${QUIZ_OPTIONS} réponses possibles, une seule correcte, les autres plausibles mais clairement fausses. Fais varier la position de la bonne réponse. Les réponses sont du texte uniquement (pas d'image).
- Remise en ordre ("wordorder") : une phrase correcte de 3 à 7 mots, mots séparés par des espaces, sans ponctuation collée qui gênerait le découpage.
- Si l'élève a donné des réponses fausses, utilise-les pour cibler la confusion (par exemple, si l'élève confond deux lettres, propose des exercices qui les distinguent).
- Produis ${VARIANTS_PER_SPOT} exercices par point faible, dans l'ordre des points faibles reçus.`;

interface SpotPayload {
  blockId: string;
  type: ReviewableExercise["type"];
  exercise: Record<string, unknown>;
  wrongAttempts: number;
  attempts: number;
  completed: boolean;
  wrongAnswers: string[];
}

function spotPayload(spot: WeakSpot): SpotPayload {
  const ex = spot.exercise;
  const exercise: Record<string, unknown> =
    ex.type === "quiz"
      ? {
          question: ex.question,
          options: ex.options.map((o) => o.text),
          correctAnswer: ex.options.find((o) => o.id === ex.correctId)?.text ?? null,
        }
      : { sentence: ex.sentence };
  return {
    blockId: spot.blockId,
    type: ex.type,
    exercise,
    wrongAttempts: spot.wrongAttempts,
    attempts: spot.attempts,
    completed: spot.completed,
    wrongAnswers: spot.wrongAnswers,
  };
}

export interface GenerationResult {
  blocks: PracticeBlock[];
  sources: PracticeSource[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Génère une série de révision. Lève PracticeConfigError si la clé API
 * manque, PracticeGenerationError si le modèle refuse ou rend une sortie
 * inexploitable.
 */
export async function generatePracticeSet(params: {
  lessonTitle: string;
  weakSpots: WeakSpot[];
}): Promise<GenerationResult> {
  const spots = params.weakSpots.slice(0, MAX_SPOTS_PER_SET);
  if (spots.length === 0) return { blocks: [], sources: [], model: DEFAULT_MODEL, usage: { input_tokens: 0, output_tokens: 0 } };

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const userMessage = JSON.stringify({ lessonTitle: params.lessonTitle, weakSpots: spots.map(spotPayload) }, null, 2);

  const response = await anthropic().messages.parse({
    model,
    max_tokens: 8000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Voici la leçon et les points faibles de l'élève :\n${userMessage}` }],
    output_config: { format: zodOutputFormat(GeneratedSetSchema), effort: "medium" },
  });

  if (response.stop_reason === "refusal") {
    throw new PracticeGenerationError(response.stop_details?.explanation ?? "Le modèle a refusé la demande");
  }
  if (response.stop_reason === "max_tokens") {
    throw new PracticeGenerationError("Réponse du modèle tronquée");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new PracticeGenerationError("Sortie du modèle inexploitable");

  const sourceMap = new Map<string, ReviewableExercise>(spots.map((s) => [s.blockId, s.exercise]));
  const blocks = toPracticeBlocks(parsed, sourceMap);
  const sources = toPracticeSources(spots);

  return {
    blocks,
    sources,
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
