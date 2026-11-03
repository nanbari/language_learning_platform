"use client";
/**
 * Une leçon jouée par l'élève, bloc après bloc : vidéo, leçon illustrée,
 * exercices de lettres, quiz, appariement, tri, mots dans l'ordre, puis
 * l'écran de fin.
 *
 * Utilisé par la page élève (/student/lesson/[id]) et, en mode `preview`, par
 * l'aperçu de l'éditeur de leçons : même rendu, mais aucun événement envoyé
 * (voir ExerciseLoggingContext), ni révision proposée, ni lien qui quitte
 * l'aperçu.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, CircleHelp, Eye, LayoutGrid, Link2, RotateCcw, VideoOff } from "lucide-react";
import { flushExerciseEvents } from "@/lib/api/events";
import { fetchPracticeSummary } from "@/lib/api/practice";
import { ExerciseLoggingContext } from "@/hooks/useExerciseTracker";
import {
  QuizRenderer, WordOrderRenderer, MatchingRenderer, DragDropRenderer,
  type ContentBlock, type Exercise, type SlideItem, type VideoItem,
  type QuizExercise, type MatchExercise, type WordOrderExercise, type DragExercise,
} from "@/components/lesson/ExerciseRenderers";
import { LessonImage } from "@/components/platform/LessonImage";
import { isLetterGameSlide, letterGameId, NEXT_LETTER_EXERCISE_DELAY_MS, type LettersBlock } from "@/lib/letterExercises";

// Les jeux de lettres embarquent la scène du cours en direct (animations, sons,
// tracés) : ce code n'est chargé qu'en arrivant sur un bloc « Lettres ».
const LetterExercise = dynamic(() => import("@/components/lesson/LetterExercise").then((m) => m.LetterExercise), {
  loading: () => <div className="ms-skeleton h-72 w-full rounded-3xl" aria-busy="true" aria-label="Chargement de l'exercice" />,
});
import { letterPlayDeck } from "@/lib/lessonActivities";
import { STUDENT_ICON } from "@/components/student/StudentShell";
import { ACCENT_PASTEL_HEX, accentButton, type Accent } from "@/components/student/accents";
import { playSound, stopSound } from "@/lib/soundPlayer";

export type LessonBlock = ContentBlock | LettersBlock;

export interface StoredLesson {
  id: string; title: string; createdAt?: string;
  blocks?: LessonBlock[];
  videos?: VideoItem[]; slideshow?: SlideItem[]; exercises?: Exercise[];
}

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0` : null;
}

// Only allow safe protocols when falling back to <video src>. Blocks javascript:, data:, etc.
function isSafeVideoUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const u = new URL(url, "http://x");
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "blob:";
  } catch { return false; }
}

function uid() { return Math.random().toString(36).slice(2, 8); }

/** Les blocs de la leçon ; les très anciennes leçons (vidéos, diaporama, exercices séparés) sont converties. */
function getLessonBlocks(lesson: StoredLesson): LessonBlock[] {
  if (lesson.blocks?.length) return lesson.blocks;
  const blocks: LessonBlock[] = [];
  for (const v of lesson.videos ?? []) blocks.push({ id: v.id, type: "video", url: v.url, title: v.title });
  if (lesson.slideshow?.length) blocks.push({ id: uid(), type: "slideshow", slides: lesson.slideshow });
  for (const ex of lesson.exercises ?? []) blocks.push({ id: uid(), type: "exercise", exercise: ex });
  return blocks;
}

/** « Activité N sur M » : un libellé court plutôt qu'une chaîne de points. */
function ActivityProgress({ index, total, accent }: { index: number; total: number; accent: Accent }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: accent.soft }} aria-hidden="true">
        <div className="h-full rounded-full transition-[width] duration-[240ms]" style={{ background: accent.pastel, width: `${(index / total) * 100}%` }} />
      </div>
      <span className="shrink-0 text-base font-bold tabular-nums text-ms-muted">Activité {index + 1} sur {total}</span>
    </div>
  );
}

/* ── Slideshow renderer ── */
function SlideshowRenderer({ slides, accent, onDone }: { slides: SlideItem[]; accent: Accent; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Précharge les sons des diapos pour que le début ne soit pas coupé.
  useEffect(() => {
    const preloads = slides.filter((sl) => sl.audioDataUrl).map((sl) => {
      const a = new Audio();
      a.preload = "auto";
      a.src = sl.audioDataUrl!;
      return a;
    });
    return () => { preloads.forEach((a) => { a.src = ""; }); };
  }, [slides]);

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  const advance = useCallback(() => {
    setIdx((prev) => {
      if (prev < slides.length - 1) return prev + 1;
      setDone(true);
      return prev;
    });
  }, [slides.length]);

  useEffect(() => {
    const slide    = slides[idx];
    const SLIDE_POST_DELAY = 2500;
    const duration = (slide.audioDuration ?? 3000) + SLIDE_POST_DELAY;

    if (timerRef.current) clearTimeout(timerRef.current);
    // Lecteur partagé : sur téléphone, il continue de jouer d'une diapo à l'autre sans nouveau toucher.
    if (slide.audioDataUrl) void playSound(slide.audioDataUrl);
    timerRef.current = setTimeout(advance, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopSound();
    };
  }, [idx, advance, slides]);

  const slide = slides[idx];

  return (
    <div className="flex-1 flex flex-col gap-6 w-full max-w-[52rem] mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <ActivityProgress index={idx} total={slides.length} accent={accent} />
      <div className="flex flex-1 items-center justify-center">
        {(slide.imageDataUrl || slide.text) ? (
          <figure className="w-full max-w-xl overflow-hidden rounded-3xl border border-ms-line bg-ms-surface shadow-[var(--ms-shadow-student)]">
            {slide.imageDataUrl && (
              <div className="flex items-center justify-center" style={{ background: accent.soft }}>
                <LessonImage src={slide.imageDataUrl} alt={slide.text || `Image ${idx + 1}`} fill={false} width={1600} height={1200}
                  priority className="h-auto max-h-[62dvh] w-full object-contain" sizes="(min-width: 640px) 36rem, 100vw" />
              </div>
            )}
            {slide.text && (
              <figcaption className="px-6 py-5 text-center text-xl font-bold leading-8 whitespace-pre-line [overflow-wrap:anywhere]">
                {slide.text}
              </figcaption>
            )}
          </figure>
        ) : (
          <div className="flex h-56 w-full max-w-xl items-center justify-center rounded-3xl border border-dashed border-ms-line bg-ms-surface text-ms-muted">
            Image {idx + 1}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Letters renderer — les écrans de lettres du cours en direct, en autonomie ── */
/**
 * Les exercices des lettres du jour du cours en direct (écrire, retrouver,
 * choisir le son), mais l'élève avance seul (voir LetterExercise) : un jeu ne
 * se passe qu'une fois réussi, la bonne réponse mène d'elle-même à
 * l'exercice suivant. Les erreurs alimentent la révision.
 */
function LettersRenderer({ block, accent, lessonId, preview, onDone }: {
  block: LettersBlock; accent: Accent; lessonId: string; preview: boolean; onDone: () => void;
}) {
  // Sur la plateforme, seulement les exercices (voir letterPlayDeck) : le
  // « bravo » final est celui de la leçon.
  const [deck] = useState(() => letterPlayDeck(block));
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    if (deck.length === 0) onDone();
  }, [deck.length, onDone]);

  // Bonne réponse : un court temps pour voir la coche, puis exercice suivant.
  useEffect(() => {
    if (!solved) return;
    const timer = setTimeout(() => {
      if (index < deck.length - 1) {
        setIndex((i) => i + 1);
        setSolved(false);
      } else {
        onDone();
      }
    }, NEXT_LETTER_EXERCISE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [solved, index, deck.length, onDone]);

  if (deck.length === 0) return null;

  return (
    <div className="flex-1 flex flex-col gap-6 w-full max-w-[52rem] mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <ActivityProgress index={index} total={deck.length} accent={accent} />
      <LetterExercise
        key={index}
        slide={deck[index]}
        previous={deck[index - 1]}
        color={ACCENT_PASTEL_HEX[accent.name]}
        accent={accent}
        lessonId={lessonId}
        eventId={!preview && isLetterGameSlide(deck[index]) ? letterGameId(block.id, deck[index]) : null}
        onSolved={() => setSolved(true)}
      />
    </div>
  );
}

export interface LessonPlayerProps {
  lesson: StoredLesson;
  accent: Accent;
  /** Retour : page d'accueil de l'espace (élève ou enseignant) et ses libellés. */
  home: string;
  homeLabel: string;
  backLabel: string;
  /** Aperçu de l'éditeur : rien n'est enregistré, rien ne quitte l'aperçu. */
  preview?: boolean;
  /** Bloc affiché en premier (aperçu d'une activité précise). */
  startIndex?: number;
}

export function LessonPlayer({ lesson, accent, home, homeLabel, backLabel, preview = false, startIndex = 0 }: LessonPlayerProps) {
  const blocks = getLessonBlocks(lesson);
  const [blockIndex, setBlockIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(blocks.length - 1, 0)));
  const [completed,  setCompleted]  = useState(false);
  // Exercices ratés sur cette leçon (null = pas encore calculé). Sert à ne
  // proposer la révision qu'à un élève qui a effectivement raté quelque chose.
  const [toReview,   setToReview]   = useState<number | null>(null);
  const [resultsFailed, setResultsFailed] = useState(false);

  // À la fin de la leçon, une fois les événements envoyés, on demande au
  // serveur ce que l'élève a raté pour lui proposer une révision ciblée.
  useEffect(() => {
    if (!completed || preview) return;
    let cancelled = false;
    (async () => {
      await flushExerciseEvents();
      const summary = await fetchPracticeSummary().catch(() => null);
      if (cancelled) return;
      if (!summary) { setResultsFailed(true); return; }
      setToReview(summary.find((s) => s.lessonId === lesson.id)?.toReview ?? 0);
    })();
    return () => { cancelled = true; };
  }, [completed, preview, lesson.id]);

  // Les exercices attendent une couleur littérale : celle du logo, avec un texte foncé dessus.
  const color = ACCENT_PASTEL_HEX[accent.name];
  const currentBlock = blocks[blockIndex] ?? null;

  const exerciseBlocks = blocks.filter((b) => b.type === "exercise");
  const exercisesDone  = blocks.slice(0, blockIndex).filter((b) => b.type === "exercise").length;

  const advanceBlock = () => {
    if (blockIndex < blocks.length - 1) setBlockIndex((i) => i + 1);
    else setCompleted(true);
  };

  /* ── Navbar shared ── */
  const nav = (
    <div className="bg-ms-surface border-b border-ms-line sticky top-0 z-40">
      <div className="mx-auto flex min-h-20 max-w-[66rem] items-center gap-3 px-4 sm:px-6">
        {preview ? (
          <span className="inline-flex shrink-0 items-center gap-2 text-base font-bold" style={{ color: "var(--ms-ink)" }}>
            <Eye size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Aperçu
          </span>
        ) : (
          <Link href={home} data-variant="quiet" className="ms-button shrink-0 -ms-3" style={{ color: "var(--ms-ink)" }}>
            <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> {homeLabel}
          </Link>
        )}
        <p className="min-w-0 flex-1 truncate text-end text-lg font-extrabold">{lesson.title || "Sans titre"}</p>
      </div>
      <div className="h-1" style={{ background: accent.pastel }} aria-hidden="true" />
    </div>
  );

  const restart = () => { setCompleted(false); setToReview(null); setResultsFailed(false); setBlockIndex(0); };
  const hasExercises = exerciseBlocks.length > 0 || blocks.some((b) => b.type === "letters");

  let body: React.ReactNode;

  if (completed || !currentBlock) {
    /* ── Completed screen ── */
    body = (
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-[1.75rem]" style={{ background: accent.soft, color: "var(--ms-ink)" }}>
            <Check size={48} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[2rem] font-extrabold leading-10">Tu as terminé.</h1>
            <p className="mt-1 text-xl font-semibold text-ms-muted [overflow-wrap:anywhere]">{lesson.title}</p>
          </div>
          {/* Le résultat, seulement quand il est connu : rien n'est promis avant la réponse du serveur. */}
          {!preview && hasExercises && (
            <p aria-live="polite" className="text-lg font-bold">
              {resultsFailed ? <span className="font-semibold text-ms-muted">Tes résultats ne sont pas disponibles pour le moment.</span>
                : toReview === null ? <span className="font-semibold text-ms-muted">Un instant…</span>
                : toReview === 0 ? <span className="text-ms-ink">Tu as tout réussi.</span>
                : <span className="text-ms-blush-ink">{toReview} exercice{toReview > 1 ? "s" : ""} à revoir.</span>}
            </p>
          )}
          {!preview && toReview !== null && toReview > 0 && (
            <Link href={`/student/practice/${lesson.id}`} data-variant="primary" className="ms-button w-full" style={{ background: "var(--ms-blush-ink)" }}>
              <RotateCcw size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Réviser maintenant
            </Link>
          )}
          <p className="text-ms-muted">{preview ? "Fin de l'aperçu." : "Tu peux rejouer cette leçon ou en choisir une autre."}</p>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <button type="button" onClick={restart} data-variant={preview ? "primary" : "secondary"} className="ms-button flex-1"
              style={preview ? accentButton(accent) : undefined}>
              Rejouer
            </button>
            {!preview && (
              <Link href={home} data-variant="primary" className="ms-button flex-1" style={accentButton(accent)}>
                {home === "/student" ? "Choisir une autre leçon" : backLabel}
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  } else if (currentBlock.type === "video") {
    /* ── Video block ── */
    const embedUrl = getYoutubeEmbedUrl(currentBlock.url);
    body = (
      <div className="flex-1 flex flex-col justify-center gap-6 w-full max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {currentBlock.title && (
          <h2 className="text-2xl font-extrabold leading-8 text-center [overflow-wrap:anywhere]">{currentBlock.title}</h2>
        )}
        <div className="overflow-hidden rounded-3xl border border-ms-line bg-ms-ink aspect-video">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" title={currentBlock.title || "Vidéo de la leçon"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          ) : isSafeVideoUrl(currentBlock.url) ? (
            <video src={currentBlock.url} controls className="w-full h-full" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-ms-surface-muted text-ms-muted">
              <VideoOff size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-base font-semibold">Cette vidéo n&apos;est pas disponible.</span>
            </div>
          )}
        </div>
        <button type="button" onClick={advanceBlock} data-variant="primary" className="ms-button w-full sm:w-auto sm:self-center sm:min-w-64"
          style={{ background: color }}>
          Continuer <ChevronRight size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    );
  } else if (currentBlock.type === "letters") {
    body = <LettersRenderer key={blockIndex} block={currentBlock} accent={accent} lessonId={lesson.id} preview={preview} onDone={advanceBlock} />;
  } else if (currentBlock.type === "slideshow") {
    body = currentBlock.slides.length > 0
      ? <SlideshowRenderer key={blockIndex} slides={currentBlock.slides} accent={accent} onDone={advanceBlock} />
      : null;
    if (!body) {
      body = (
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <button type="button" onClick={advanceBlock} data-variant="secondary" className="ms-button">Continuer</button>
        </div>
      );
    }
  } else {
    /* ── Exercise block ── */
    const ex = currentBlock.exercise;
    body = (
      <div className="flex-1 flex flex-col justify-center w-full max-w-2xl mx-auto px-4 py-10">
        {ex.type !== "wordorder" && (
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-bold mb-3"
              style={{ background: accent.soft, color: "var(--ms-ink)" }}>
              {ex.type === "quiz" ? <><CircleHelp size={20} strokeWidth={1.75} aria-hidden="true" /> Quiz</>
                : ex.type === "matching" ? <><Link2 size={20} strokeWidth={1.75} aria-hidden="true" /> Appariement</>
                : <><LayoutGrid size={20} strokeWidth={1.75} aria-hidden="true" /> Tri</>}
              {exerciseBlocks.length > 1 && ` · ${exercisesDone + 1}/${exerciseBlocks.length}`}
            </div>
          </div>
        )}

        {ex.type === "quiz" && (
          <QuizRenderer key={blockIndex} ex={ex as QuizExercise} color={color} onNext={advanceBlock}
            idx={exercisesDone} total={exerciseBlocks.length} lessonId={lesson.id} blockId={currentBlock.id} />
        )}
        {ex.type === "matching" && (
          <MatchingRenderer key={blockIndex} ex={ex as MatchExercise} color={color} onNext={advanceBlock}
            lessonId={lesson.id} blockId={currentBlock.id} />
        )}
        {ex.type === "wordorder" && (
          <WordOrderRenderer key={blockIndex} ex={ex as WordOrderExercise} color={color} onNext={advanceBlock}
            lessonId={lesson.id} blockId={currentBlock.id} />
        )}
        {ex.type === "dragdrop" && (
          <DragDropRenderer key={blockIndex} ex={ex as DragExercise} color={color} onNext={advanceBlock}
            lessonId={lesson.id} blockId={currentBlock.id} />
        )}
      </div>
    );
  }

  return (
    <ExerciseLoggingContext.Provider value={!preview}>
      <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas flex flex-col">
        {nav}
        {body}
      </div>
    </ExerciseLoggingContext.Provider>
  );
}
