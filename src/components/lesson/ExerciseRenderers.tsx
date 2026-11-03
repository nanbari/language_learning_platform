"use client";
/**
 * Rendus des exercices d’une leçon (quiz, remise en ordre, appariement, tri).
 *
 * Partagés entre la page de leçon et la page de révision personnalisée :
 * chaque rendu journalise ses événements via useExerciseTracker avec le
 * lessonId / blockId reçus, quelle que soit la page qui l’affiche.
 *
 * Présentation de l'espace élève (data-ms-area="student") : cibles de
 * 64 px, retour sans message : confettis à la réussite, tremblement de la
 * réponse essayée à l'échec (comme les jeux de lettres du cours en direct). `color` est une teinte profonde qui porte du
 * texte blanc (voir accents.ts).
 */
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { ArrowLeftRight, Check, ChevronRight, ImageOff, Volume2 } from "lucide-react";
import { useExerciseTracker } from "@/hooks/useExerciseTracker";
import { LessonImage } from "@/components/platform/LessonImage";
import { playSound, stopSound } from "@/lib/soundPlayer";
import { LazyConfetti } from "@/components/LazyConfetti";

/* ── Types ── */
export interface QuizOption { id: string; text: string; imageDataUrl?: string; }
export interface QuizExercise {
  type: "quiz";
  question: string;
  options: QuizOption[];
  correctId: string;
  audioDataUrl?: string;
  answerMode: "image" | "text" | "both";
}
interface MatchPair { id: string; left: string; right: string; }
export interface MatchExercise { type: "matching"; pairs: MatchPair[]; }
interface DragItem { id: string; text: string; category: string; }
interface DragCategory { id: string; label: string; }
export interface DragExercise { type: "dragdrop"; items: DragItem[]; categories: DragCategory[]; }
export interface WordOrderExercise { type: "wordorder"; sentence: string; audioDataUrl?: string; answerAudioDataUrl?: string; }
export type Exercise = QuizExercise | MatchExercise | DragExercise | WordOrderExercise;
export interface SlideItem { id: string; imageDataUrl: string; text?: string; audioDataUrl?: string; audioDuration?: number; }
export interface VideoItem { id: string; url: string; title: string; }

export type ContentBlock =
  | { id: string; type: "video";     url: string; title: string }
  | { id: string; type: "slideshow"; slides: SlideItem[] }
  | { id: string; type: "exercise";  exercise: Exercise }

/** Icônes de l'espace élève (même valeur que STUDENT_ICON). */
const ICON = 28;
const STROKE = 1.75;

// Repère l'arabe pour orienter la zone de réponse et choisir la police.
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const isArabic = (text: string) => ARABIC_RE.test(text);
const ARABIC_TEXT = "ms-arabic text-[1.75rem]";

/** Retour de l'exercice, dans une zone réservée pour que la page ne saute pas.
    Rien de visible : confettis à la réussite, tremblement à l'échec (voir
    .ms-shake) ; le texte reste pour les lecteurs d'écran. */
function Feedback({ state, retryText }: { state: "none" | "found" | "retry"; retryText: string }) {
  return (
    <div aria-live="polite" className="flex min-h-16 items-center justify-center text-center text-xl font-bold leading-7">
      {state === "found" && (
        <>
          <LazyConfetti />
          <span className="sr-only">Tu as trouvé.</span>
        </>
      )}
      {state === "retry" && <span className="sr-only">{retryText}</span>}
    </div>
  );
}

/** Bouton d'écoute à la taille d'un doigt d'enfant. */
function ListenButton({ onClick, label, ariaLabel, color }: { onClick: () => void; label: string; ariaLabel: string; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} data-variant={color ? "primary" : "secondary"}
      className="ms-button min-w-44 shrink-0" style={color ? { background: color, color: "var(--ms-ink)" } : undefined}>
      <Volume2 size={ICON} strokeWidth={STROKE} aria-hidden="true" />
      {label}
    </button>
  );
}

/** Bouton principal coloré par la leçon ; neutre (jetons) quand il est désactivé. */
function PrimaryAction({ color, disabled, onClick, children }: {
  color: string; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-variant="primary"
      className="ms-button w-full" style={disabled ? undefined : { background: color, color: "var(--ms-ink)" }}>
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Quiz renderer — handles image / text / both
───────────────────────────────────────────── */
export function QuizRenderer({ ex, color, onNext, idx, total, lessonId, blockId }: {
  ex: QuizExercise; color: string; onNext: () => void; idx: number; total: number;
  lessonId: string; blockId: string;
}) {
  // Dernière réponse fausse : marquée calmement, elle reste rejouable.
  const [wrongId, setWrongId]   = useState<string | null>(null);
  const [correct, setCorrect]   = useState(false);
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "quiz" });

  const playAudio = () => {
    if (ex.audioDataUrl) void playSound(ex.audioDataUrl);
  };

  useEffect(() => {
    if (!ex.audioDataUrl) return;
    void playSound(ex.audioDataUrl);
    return () => stopSound();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SOUND_DURATION = 3200;
  const POST_DELAY = 2500;

  const playSuccessSound = () => {
    void playSound("/sounds/bravo.mp3");
    setTimeout(() => stopSound("/sounds/bravo.mp3"), SOUND_DURATION);
  };

  const handleSelect = (id: string) => {
    if (correct) return;
    track.attempt(id === ex.correctId, { optionId: id });
    if (id === ex.correctId) {
      setWrongId(null);
      setCorrect(true);
      playSuccessSound();
      setTimeout(() => { onNext(); }, SOUND_DURATION + POST_DELAY);
    } else {
      setWrongId(id);
    }
  };

  const showImage = ex.answerMode === "image" || ex.answerMode === "both";
  const showText  = ex.answerMode === "text"  || ex.answerMode === "both";
  const questionIsArabic = isArabic(ex.question);
  const feedback = correct ? "found" : wrongId ? "retry" : "none";

  const stateOf = (optId: string) =>
    correct && optId === ex.correctId ? "found" : wrongId === optId ? "tried" : "rest";
  const labelOf = (opt: QuizOption) => {
    const state = stateOf(opt.id);
    return `${opt.text || "Image"}${state === "found" ? " — bonne réponse" : state === "tried" ? " — déjà essayée" : ""}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6">
      {total > 0 && <p className="sr-only">Question {Math.min(idx + 1, total)} sur {total}</p>}

      {/* Question */}
      <div className="ms-panel flex flex-col items-center gap-4 px-5 py-6 text-center sm:px-8">
        <h2
          {...(questionIsArabic ? { lang: "ar", dir: "rtl" } : { dir: "auto" })}
          className={`min-w-0 [overflow-wrap:anywhere] ${questionIsArabic ? ARABIC_TEXT : "text-xl font-bold leading-7 sm:text-2xl sm:leading-8"}`}
        >
          {ex.question}
        </h2>
        {ex.audioDataUrl && <ListenButton onClick={playAudio} label="Réécouter" ariaLabel="Réécouter la question" color={color} />}
      </div>

      {/* Options */}
      {showImage ? (
        <div role="group" aria-label="Réponses" className="grid gap-2 min-[400px]:gap-3 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(ex.options.length, 3)}, minmax(0, 1fr))` }}>
          {ex.options.map((opt) => {
            const state = stateOf(opt.id);
            return (
              <button key={opt.id} type="button" onClick={() => handleSelect(opt.id)} disabled={correct}
                data-state={state} aria-label={labelOf(opt)}
                className="ms-answer-tile !justify-start !p-2 sm:!p-3">
                <span className="ms-answer-glyph block w-full">
                  {opt.imageDataUrl ? (
                    <span className="relative block aspect-square w-full overflow-hidden rounded-2xl">
                      <LessonImage src={opt.imageDataUrl} alt="" className="object-cover" sizes="(min-width: 640px) 12rem, 30vw" />
                    </span>
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-ms-surface-muted text-ms-muted">
                      <ImageOff size={32} strokeWidth={STROKE} aria-hidden="true" />
                    </span>
                  )}
                </span>
                {showText && opt.text && (
                  <span dir="auto" className={`ms-answer-glyph min-w-0 px-1 pb-1 text-center [overflow-wrap:anywhere] ${isArabic(opt.text) ? ARABIC_TEXT : "text-lg font-bold leading-6"}`}>
                    {opt.text}
                  </span>
                )}
                {state === "found" && (
                  <span className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ms-blush text-ms-ink">
                    <Check size={22} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Text-only options — vertical list */
        <div role="group" aria-label="Réponses" className="flex flex-col gap-3">
          {ex.options.map((opt) => {
            const state = stateOf(opt.id);
            const cls =
              state === "found" ? "border-ms-blush bg-ms-blush-soft"
              : state === "tried" ? "border-dashed border-ms-line bg-ms-surface-muted text-ms-muted"
              : "border-ms-control bg-ms-surface [@media(hover:hover)]:hover:border-ms-primary";
            return (
              <button key={opt.id} type="button" onClick={() => handleSelect(opt.id)} disabled={correct}
                data-state={state} aria-label={labelOf(opt)}
                className={`flex min-h-16 w-full items-center gap-4 rounded-[1.25rem] border-2 px-5 py-3 text-start text-lg font-bold leading-7 transition-colors duration-[140ms] disabled:cursor-default ${cls}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  state === "found" ? "bg-ms-blush text-ms-ink" : "border-2 border-ms-control"
                }`} aria-hidden="true">
                  {state === "found" && <Check size={22} strokeWidth={2.5} />}
                </span>
                <span dir="auto" className={`min-w-0 [overflow-wrap:anywhere] ${isArabic(opt.text) ? ARABIC_TEXT : ""}`}>
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Feedback state={feedback} retryText={ex.audioDataUrl ? "Écoute encore. Tu peux réessayer." : "Regarde encore. Tu peux réessayer."} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Word-order renderer — reorder words to form a sentence
───────────────────────────────────────────── */
export function WordOrderRenderer({ ex, color, onNext, lessonId, blockId }: {
  ex: WordOrderExercise; color: string; onNext: () => void; lessonId: string; blockId: string;
}) {
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "wordorder" });
  const targetWords = ex.sentence.split(/\s+/).filter(Boolean);
  // Detect Arabic so the answer zone reads right-to-left
  const isRTL = isArabic(ex.sentence);
  const [pool, setPool]       = useState<{ id: string; word: string }[]>([]);
  const [chosen, setChosen]   = useState<{ id: string; word: string }[]>([]);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");

  useEffect(() => {
    const tokens = targetWords.map((w, i) => ({ id: `${i}-${w}`, word: w }));
    setPool([...tokens].sort(() => Math.random() - 0.5));
    setChosen([]);
    setFeedback("none");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.sentence]);

  const speakInstruction = useCallback(() => {
    // Prefer teacher's recorded audio when available
    if (ex.audioDataUrl) {
      void playSound(ex.audioDataUrl);
      return;
    }
    // Fallback: browser speech synthesis in Arabic
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("رتّب الكلمات");
    u.lang = "ar-SA";
    u.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith("ar"));
    if (arVoice) u.voice = arVoice;
    window.speechSynthesis.speak(u);
  }, [ex.audioDataUrl]);

  useEffect(() => {
    // Autoplay teacher's audio directly when present
    if (ex.audioDataUrl) {
      void playSound(ex.audioDataUrl);
      return () => stopSound();
    }
    // Otherwise fall back to TTS; voices may load async
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const trigger = () => speakInstruction();
    if (synth.getVoices().length > 0) {
      trigger();
    } else {
      synth.addEventListener("voiceschanged", trigger, { once: true });
    }
    return () => {
      synth.cancel();
      synth.removeEventListener("voiceschanged", trigger);
    };
  }, [ex.sentence, ex.audioDataUrl, speakInstruction]);

  const pickFromPool = (id: string) => {
    if (feedback === "correct") return;
    const item = pool.find((p) => p.id === id);
    if (!item) return;
    setPool((prev) => prev.filter((p) => p.id !== id));
    setChosen((prev) => [...prev, item]);
    if (feedback === "wrong") setFeedback("none");
  };

  const removeFromChosen = (id: string) => {
    if (feedback === "correct") return;
    const item = chosen.find((p) => p.id === id);
    if (!item) return;
    setChosen((prev) => prev.filter((p) => p.id !== id));
    setPool((prev) => [...prev, item]);
    if (feedback === "wrong") setFeedback("none");
  };

  const validate = () => {
    if (chosen.length !== targetWords.length || targetWords.length === 0) return;
    const ok = chosen.every((c, i) => c.word === targetWords[i]);
    track.attempt(ok, { words: chosen.map((c) => c.word) });
    if (ok) {
      setFeedback("correct");
      const BRAVO_MS  = 2300;
      const POST_DELAY = 2500;
      void playSound("/sounds/bravo.mp3");
      const advance = () => setTimeout(onNext, POST_DELAY);
      const playAnswerThenAdvance = () => {
        stopSound("/sounds/bravo.mp3");
        if (!ex.answerAudioDataUrl) {
          advance();
          return;
        }
        void playSound(ex.answerAudioDataUrl, advance).then((ok) => { if (!ok) advance(); });
      };
      setTimeout(playAnswerThenAdvance, BRAVO_MS);
    } else {
      setFeedback("wrong");
    }
  };

  const wordClass = isRTL ? ARABIC_TEXT : "text-xl font-bold";
  const wordLang = isRTL ? { lang: "ar" } : {};

  return (
    <div className="ms-panel mx-auto flex w-full max-w-[52rem] flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-xl font-bold leading-7 sm:text-2xl sm:leading-8">Remets les mots dans l&apos;ordre</h2>
        <p dir="rtl" lang="ar" className={`${ARABIC_TEXT} text-ms-muted`}>رتِّب الكلمات</p>
        <ListenButton onClick={speakInstruction} label="Écouter" ariaLabel="Écouter la consigne" />
      </div>

      {/* Answer zone */}
      <div
        role="group"
        aria-label="Ta phrase"
        dir={isRTL ? "rtl" : "ltr"}
        className={`flex min-h-24 flex-wrap items-center gap-3 rounded-[1.25rem] border-2 p-3 transition-colors duration-[180ms] sm:p-4 ${
          feedback === "correct" ? "border-ms-blush bg-ms-blush-soft" : "border-dashed border-ms-control bg-ms-canvas"
        } ${feedback === "wrong" ? "ms-shake" : ""}`}
      >
        {chosen.length === 0 ? (
          <span dir="ltr" className="mx-auto text-ms-muted">Touche les mots ci-dessous.</span>
        ) : (
          chosen.map((c) => (
            <button key={c.id} type="button" onClick={() => removeFromChosen(c.id)}
              disabled={feedback === "correct"}
              {...wordLang}
              aria-label={`${c.word}, retirer`}
              className={`min-h-16 min-w-16 rounded-2xl px-5 py-2 text-ms-ink disabled:cursor-default ${wordClass}`}
              style={{ background: color }}>
              {c.word}
            </button>
          ))
        )}
      </div>

      {/* Pool */}
      <div role="group" aria-label="Mots à placer" dir={isRTL ? "rtl" : "ltr"} className="flex min-h-16 flex-wrap justify-center gap-3">
        {pool.map((p) => (
          <button key={p.id} type="button" onClick={() => pickFromPool(p.id)}
            {...wordLang}
            className={`min-h-16 min-w-16 rounded-2xl border-2 border-ms-control bg-ms-surface px-5 py-2 transition-colors duration-[140ms] [@media(hover:hover)]:hover:border-ms-primary ${wordClass}`}>
            {p.word}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryAction color={color} onClick={validate}
          disabled={chosen.length !== targetWords.length || feedback === "correct" || targetWords.length === 0}>
          {feedback === "correct" ? (<><Check size={ICON} strokeWidth={2} aria-hidden="true" /> Bien placé</>) : "Vérifier"}
        </PrimaryAction>
        <Feedback state={feedback === "correct" ? "found" : feedback === "wrong" ? "retry" : "none"}
          retryText="Écoute encore. Tu peux réessayer." />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Matching / drag-drop — rendus non interactifs pour l'instant :
   on journalise un simple affichage (« view ») quand l'élève continue.
───────────────────────────────────────────── */
export function MatchingRenderer({ ex, color, onNext, lessonId, blockId }: {
  ex: MatchExercise; color: string; onNext: () => void; lessonId: string; blockId: string;
}) {
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "matching" });
  return (
    <div className="ms-panel mx-auto flex w-full max-w-[52rem] flex-col gap-6 px-4 py-6 sm:px-8">
      <h2 className="text-center text-xl font-bold leading-7 sm:text-2xl sm:leading-8">Associe les paires</h2>
      <ul className="flex flex-col gap-3">
        {ex.pairs.map((p) => (
          <li key={p.id} className="flex items-center gap-2 sm:gap-3">
            <span dir="auto" className={`flex min-h-16 min-w-0 flex-1 items-center justify-center rounded-2xl bg-ms-slate-soft px-4 py-3 text-center font-bold text-ms-slate-ink [overflow-wrap:anywhere] ${isArabic(p.left) ? ARABIC_TEXT : "text-lg"}`}>
              {p.left}
            </span>
            <ArrowLeftRight size={24} strokeWidth={STROKE} className="shrink-0 text-ms-muted" aria-label="va avec" />
            <span dir="auto" className={`flex min-h-16 min-w-0 flex-1 items-center justify-center rounded-2xl bg-ms-sage-soft px-4 py-3 text-center font-bold text-ms-sage-ink [overflow-wrap:anywhere] ${isArabic(p.right) ? ARABIC_TEXT : "text-lg"}`}>
              {p.right}
            </span>
          </li>
        ))}
      </ul>
      <PrimaryAction color={color} onClick={() => { track.view(); onNext(); }}>
        Continuer <ChevronRight size={ICON} strokeWidth={STROKE} aria-hidden="true" />
      </PrimaryAction>
    </div>
  );
}

const CATEGORY_TINTS = [
  "border-ms-slate bg-ms-slate-soft text-ms-slate-ink",
  "border-ms-sage bg-ms-sage-soft text-ms-sage-ink",
  "border-ms-blush bg-ms-blush-soft text-ms-blush-ink",
];

export function DragDropRenderer({ ex, color, onNext, lessonId, blockId }: {
  ex: DragExercise; color: string; onNext: () => void; lessonId: string; blockId: string;
}) {
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "dragdrop" });
  return (
    <div className="ms-panel mx-auto flex w-full max-w-[52rem] flex-col gap-6 px-4 py-6 sm:px-8">
      <h2 className="text-center text-xl font-bold leading-7 sm:text-2xl sm:leading-8">Classe les éléments</h2>
      <ul className="flex flex-wrap justify-center gap-3">
        {ex.items.map((item) => (
          <li key={item.id} dir="auto"
            className={`flex min-h-16 min-w-0 items-center rounded-2xl border-2 border-ms-control bg-ms-surface px-5 py-3 font-bold [overflow-wrap:anywhere] ${isArabic(item.text) ? ARABIC_TEXT : "text-lg"}`}>
            {item.text}
          </li>
        ))}
      </ul>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))" }}>
        {ex.categories.map((cat, i) => (
          <div key={cat.id}
            className={`flex min-h-24 items-start justify-center rounded-[1.25rem] border-2 border-dashed p-4 text-center ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]}`}>
            <p dir="auto" className="min-w-0 text-lg font-bold [overflow-wrap:anywhere]">{cat.label}</p>
          </div>
        ))}
      </div>
      <PrimaryAction color={color} onClick={() => { track.view(); onNext(); }}>
        Continuer <ChevronRight size={ICON} strokeWidth={STROKE} aria-hidden="true" />
      </PrimaryAction>
    </div>
  );
}
