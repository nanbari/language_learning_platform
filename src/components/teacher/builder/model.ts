/**
 * Modèle de l'éditeur de leçons : les blocs tels qu'ils sont enregistrés
 * (le schéma ne change pas), leurs libellés, leur résumé dans le plan et ce
 * qui empêche l'enregistrement.
 */
import {
  AlignJustify, BookOpen, CircleHelp, Layers, PenLine, Shuffle, Video, type LucideIcon,
} from "lucide-react";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { hasLessonLetters, lettersPerLesson } from "@/lib/presentation";
import type { LettersBlock } from "@/lib/liveDeck";

interface SlideItem { id: string; imageDataUrl: string; text?: string; audioDataUrl?: string; audioDuration?: number; }
type ExerciseType = "quiz" | "matching" | "dragdrop" | "wordorder";
export type AnswerMode = "image" | "text" | "both";
interface QuizOption { id: string; text: string; imageDataUrl?: string; }
export interface QuizExercise {
  type: "quiz"; question: string; options: QuizOption[];
  correctId: string; audioDataUrl?: string; answerMode: AnswerMode;
}
interface MatchPair { id: string; left: string; right: string; }
export interface MatchExercise { type: "matching"; pairs: MatchPair[]; }
interface DragItem { id: string; text: string; category: string; }
interface DragCategory { id: string; label: string; }
export interface DragExercise { type: "dragdrop"; items: DragItem[]; categories: DragCategory[]; }
export interface WordOrderExercise { type: "wordorder"; sentence: string; audioDataUrl?: string; answerAudioDataUrl?: string; }
export type Exercise = QuizExercise | MatchExercise | DragExercise | WordOrderExercise;

export type VideoBlock     = { id: string; type: "video";     url: string; title: string; }
export type SlideshowBlock = { id: string; type: "slideshow"; slides: SlideItem[]; }
export type ExerciseBlock  = { id: string; type: "exercise";  exercise: Exercise; }
export type ContentBlock   = VideoBlock | SlideshowBlock | ExerciseBlock | LettersBlock;

export type ActivityKind = "video" | "slideshow" | "letters" | ExerciseType;
export type ExerciseAudioField = "audioDataUrl" | "answerAudioDataUrl";

/** Famille d'une activité : sa couleur de la charte, toujours la même (contenu, lettres, exercice). */
export type ActivityFamily = "content" | "letters" | "exercise";

export const FAMILY_TONE: Record<ActivityFamily, { soft: string; ink: string; label: string }> = {
  content:  { soft: "var(--ms-slate-soft)", ink: "var(--ms-slate-ink)", label: "Contenu" },
  letters:  { soft: "var(--ms-sage-soft)",  ink: "var(--ms-sage-ink)",  label: "Lettres" },
  exercise: { soft: "var(--ms-blush-soft)", ink: "var(--ms-blush-ink)", label: "Exercice" },
};

export const ACTIVITY_KINDS: { kind: ActivityKind; label: string; short: string; description: string; icon: LucideIcon; family: ActivityFamily }[] = [
  { kind: "letters",   label: "Lettres", short: "Lettres",               description: "Tracé, sons et exercices des lettres du jour", icon: PenLine,      family: "letters" },
  { kind: "slideshow", label: "Leçon illustrée", short: "Leçon illustrée",       description: "Images, texte et votre voix",                  icon: BookOpen,     family: "content" },
  { kind: "video",     label: "Vidéo", short: "Vidéo",                 description: "Lien YouTube ou fichier vidéo",                icon: Video,        family: "content" },
  { kind: "quiz",      label: "Quiz à choix multiple", short: "Quiz", description: "Une question, trois réponses",                 icon: CircleHelp,   family: "exercise" },
  { kind: "matching",  label: "Appariement", short: "Appariement",           description: "Des paires à associer",                        icon: Shuffle,      family: "exercise" },
  { kind: "dragdrop",  label: "Glisser-déposer", short: "Glisser-déposer",       description: "Des éléments à classer",                       icon: Layers,       family: "exercise" },
  { kind: "wordorder", label: "Mots dans l'ordre", short: "Mots dans l'ordre",     description: "Une phrase à remettre en ordre",               icon: AlignJustify, family: "exercise" },
];

export function kindOf(block: ContentBlock): ActivityKind {
  return block.type === "exercise" ? block.exercise.type : block.type;
}

export function kindMeta(kind: ActivityKind) {
  return ACTIVITY_KINDS.find((k) => k.kind === kind)!;
}

export function uid() { return Math.random().toString(36).slice(2, 8); }

function makeExercise(type: ExerciseType): Exercise {
  if (type === "quiz") return {
    type: "quiz", question: "", correctId: "", answerMode: "image",
    options: [{ id: uid(), text: "" }, { id: uid(), text: "" }, { id: uid(), text: "" }],
  };
  if (type === "matching") return {
    type: "matching",
    pairs: [{ id: uid(), left: "", right: "" }, { id: uid(), left: "", right: "" }],
  };
  if (type === "wordorder") return { type: "wordorder", sentence: "" };
  return {
    type: "dragdrop",
    items: [{ id: uid(), text: "", category: "a" }],
    categories: [{ id: "a", label: "Catégorie A" }, { id: "b", label: "Catégorie B" }],
  };
}

export function makeBlock(kind: ActivityKind): ContentBlock {
  if (kind === "letters") return { id: uid(), type: "letters", level: "beginner", letterIds: [], reviewIds: [] };
  if (kind === "video") return { id: uid(), type: "video", url: "", title: "" };
  if (kind === "slideshow") return { id: uid(), type: "slideshow", slides: [{ id: uid(), imageDataUrl: "" }] };
  return { id: uid(), type: "exercise", exercise: makeExercise(kind) };
}

/** Copie indépendante d'un bloc, avec de nouveaux identifiants là où le rendu en dépend. */
export function duplicateOf(block: ContentBlock): ContentBlock {
  const copy = JSON.parse(JSON.stringify(block)) as ContentBlock;
  copy.id = uid();
  if (copy.type === "slideshow") copy.slides = copy.slides.map((s) => ({ ...s, id: uid() }));
  return copy;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/** Une ligne pour le plan : ce que contient l'activité, sans l'ouvrir. */
export function blockSummary(block: ContentBlock): string {
  switch (block.type) {
    case "video":
      if (block.title.trim()) return block.title.trim();
      if (!block.url.trim()) return "Aucune vidéo";
      try { return new URL(block.url).hostname.replace(/^www\./, ""); } catch { return block.url; }
    case "slideshow": {
      const withImage = block.slides.filter((s) => s.imageDataUrl).length;
      return `${plural(block.slides.length, "image")}${withImage < block.slides.length ? ` · ${block.slides.length - withImage} à compléter` : ""}`;
    }
    case "letters": {
      if (block.letterIds.length === 0) return block.level === "beginner" ? "Débutant · aucune lettre" : "Avancé · aucune lettre";
      const glyphs = block.letterIds.map((id) => ARABIC_ALPHABET.find((l) => l.id === id)?.isolated ?? "").join(" ");
      return `${block.level === "beginner" ? "Débutant" : "Avancé"} · ${glyphs}`;
    }
    case "exercise": {
      const ex = block.exercise;
      if (ex.type === "quiz") return ex.question.trim() || "Question à écrire";
      if (ex.type === "matching") return plural(ex.pairs.length, "paire");
      if (ex.type === "dragdrop") return `${plural(ex.items.length, "élément")} · ${plural(ex.categories.length, "catégorie")}`;
      return ex.sentence.trim() || "Phrase à écrire";
    }
  }
}

/** Ce qui empêche d'enregistrer la leçon (mêmes règles qu'avant la refonte), ou null. */
export function blockIssue(block: ContentBlock): string | null {
  if (block.type === "exercise" && block.exercise.type === "quiz" && !block.exercise.correctId) {
    return "Marquez la bonne réponse.";
  }
  if (block.type === "letters" && !hasLessonLetters(block.level, block.letterIds.length)) {
    const max = lettersPerLesson(block.level);
    return `Choisissez ${max > 1 ? `une à ${max} lettres` : "une lettre"}.`;
  }
  return null;
}
