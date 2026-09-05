"use client";
/**
 * Rendus des exercices d’une leçon (quiz, remise en ordre, appariement, tri).
 *
 * Partagés entre la page de leçon et la page de révision personnalisée :
 * chaque rendu journalise ses événements via useExerciseTracker avec le
 * lessonId / blockId reçus, quelle que soit la page qui l’affiche.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { useExerciseTracker } from "@/lib/useExerciseTracker";

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
export interface MatchPair { id: string; left: string; right: string; }
export interface MatchExercise { type: "matching"; pairs: MatchPair[]; }
export interface DragItem { id: string; text: string; category: string; }
export interface DragCategory { id: string; label: string; }
export interface DragExercise { type: "dragdrop"; items: DragItem[]; categories: DragCategory[]; }
export interface WordOrderExercise { type: "wordorder"; sentence: string; audioDataUrl?: string; answerAudioDataUrl?: string; }
export type Exercise = QuizExercise | MatchExercise | DragExercise | WordOrderExercise;
export interface SlideItem { id: string; imageDataUrl: string; text?: string; audioDataUrl?: string; audioDuration?: number; }
export interface VideoItem { id: string; url: string; title: string; }

export type ContentBlock =
  | { id: string; type: "video";     url: string; title: string }
  | { id: string; type: "slideshow"; slides: SlideItem[] }
  | { id: string; type: "exercise";  exercise: Exercise }

/* ─────────────────────────────────────────────
   Quiz renderer — handles image / text / both
───────────────────────────────────────────── */
export function QuizRenderer({ ex, color, onNext, idx, total, lessonId, blockId }: {
  ex: QuizExercise; color: string; onNext: () => void; idx: number; total: number;
  lessonId: string; blockId: string;
}) {
  const [wrongId, setWrongId]   = useState<string | null>(null);
  const [correct, setCorrect]   = useState(false);
  const [shake, setShake]       = useState(false);
  const { addPoints } = useGameStore();
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "quiz" });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = () => {
    if (!ex.audioDataUrl) return;
    audioRef.current?.pause();
    const a = new Audio(ex.audioDataUrl);
    audioRef.current = a;
    // Un média illisible ne doit pas remonter en erreur non gérée
    a.play().catch(() => {});
  };

  useEffect(() => {
    if (!ex.audioDataUrl) return;
    const a = new Audio(ex.audioDataUrl);
    audioRef.current = a;
    const promise = a.play();
    if (promise !== undefined) {
      promise.catch(() => {});
    }
    return () => { a.pause(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SOUND_DURATION = 3200;
  const POST_DELAY = 2500;

  const playSuccessSound = () => {
    const a = new Audio("/sounds/bravo.mp3");
    a.play().catch(() => {});
    setTimeout(() => { a.pause(); }, SOUND_DURATION);
  };

  const handleSelect = (id: string) => {
    if (correct) return;
    track.attempt(id === ex.correctId, { optionId: id });
    if (id === ex.correctId) {
      addPoints(10);
      setWrongId(null);
      setCorrect(true);
      playSuccessSound();
      setTimeout(() => { onNext(); }, SOUND_DURATION + POST_DELAY);
    } else {
      setWrongId(id);
      setShake(true);
      setTimeout(() => { setShake(false); setWrongId(null); }, 600);
    }
  };

  const showImage = ex.answerMode === "image" || ex.answerMode === "both";
  const showText  = ex.answerMode === "text"  || ex.answerMode === "both";

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ background: color, width: `${(idx / total) * 100}%` }} />
        </div>
        <span className="text-sm font-bold text-gray-500">{idx}/{total}</span>
      </div>

      {/* Question */}
      <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100 mb-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h2 className="text-xl font-black text-[#2d2d2d]">{ex.question}</h2>
          {ex.audioDataUrl && (
            <button onClick={playAudio}
              className="w-10 h-10 rounded-full bg-[#8BA3B1]/10 hover:bg-[#8BA3B1]/20 flex items-center justify-center transition-colors shrink-0">
              <Volume2 size={18} className="text-[#8BA3B1]" />
            </button>
          )}
        </div>
      </div>

      {/* Options — horizontal if image mode */}
      {showImage ? (
        <div className="flex gap-3">
          {ex.options.map((opt) => {
            const isWrong   = wrongId === opt.id;
            const isAnswer  = opt.id === ex.correctId;
            let border = "border-gray-200 hover:border-[#8BA3B1]";
            let bg = "bg-white";
            if (correct && isAnswer)  { border = "border-[#95d5b2]"; bg = "bg-[#f0faf5]"; }
            else if (isWrong)         { border = "border-[#ff8fa3]"; bg = "bg-[#fff0f3]"; }

            return (
              <button key={opt.id} onClick={() => handleSelect(opt.id)} disabled={correct}
                className={`flex-1 rounded-2xl border-2 ${border} ${bg} overflow-hidden transition-all disabled:cursor-default hover:scale-[1.02] disabled:hover:scale-100 shadow-sm ${isWrong && shake ? "animate-wiggle" : ""}`}>
                {opt.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opt.imageDataUrl} alt={opt.text} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-gray-50">
                    <span className="text-4xl">❓</span>
                  </div>
                )}
                {showText && (
                  <div className="p-2 flex items-center justify-center gap-1">
                    {correct && isAnswer && <CheckCircle size={14} className="text-[#95d5b2] shrink-0" />}
                    <span className="text-xs font-semibold text-[#2d2d2d] truncate">{opt.text}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Text-only options — vertical list */
        <div className="flex flex-col gap-3">
          {ex.options.map((opt) => {
            const isWrong  = wrongId === opt.id;
            const isAnswer = opt.id === ex.correctId;
            let cls = "border-gray-200 bg-white hover:border-[#8BA3B1] hover:bg-[#8BA3B1]/5";
            if (correct && isAnswer) cls = "border-[#95d5b2] bg-[#f0faf5]";
            else if (isWrong)        cls = "border-[#ff8fa3] bg-[#fff0f3]";

            return (
              <button key={opt.id} onClick={() => handleSelect(opt.id)} disabled={correct}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left font-semibold transition-all ${cls} ${isWrong && shake ? "animate-wiggle" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  correct && isAnswer ? "bg-[#95d5b2] text-white" :
                  isWrong             ? "bg-[#ff8fa3] text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {correct && isAnswer ? <CheckCircle size={16} /> : isWrong ? <XCircle size={16} /> : "◦"}
                </div>
                <span className="text-[#2d2d2d]">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}

/* ─────────────────────────────────────────────
   Word-order renderer — reorder words to form a sentence
───────────────────────────────────────────── */
export function WordOrderRenderer({ ex, color, onNext, lessonId, blockId }: {
  ex: WordOrderExercise; color: string; onNext: () => void; lessonId: string; blockId: string;
}) {
  const { addPoints } = useGameStore();
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "wordorder" });
  const targetWords = ex.sentence.split(/\s+/).filter(Boolean);
  // Detect Arabic so the answer zone reads right-to-left
  const isRTL = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(ex.sentence);
  const [pool, setPool]       = useState<{ id: string; word: string }[]>([]);
  const [chosen, setChosen]   = useState<{ id: string; word: string }[]>([]);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");
  const [shake, setShake]     = useState(false);

  useEffect(() => {
    const tokens = targetWords.map((w, i) => ({ id: `${i}-${w}`, word: w }));
    setPool([...tokens].sort(() => Math.random() - 0.5));
    setChosen([]);
    setFeedback("none");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.sentence]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakInstruction = useCallback(() => {
    // Prefer teacher's recorded audio when available
    if (ex.audioDataUrl) {
      audioRef.current?.pause();
      const a = new Audio(ex.audioDataUrl);
      audioRef.current = a;
      a.play().catch(() => {});
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
      const a = new Audio(ex.audioDataUrl);
      audioRef.current = a;
      a.play().catch(() => {});
      return () => { a.pause(); };
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
      addPoints(10);
      setFeedback("correct");
      const BRAVO_MS  = 2300;
      const POST_DELAY = 2500;
      const bravo = new Audio("/sounds/bravo.mp3");
      bravo.play().catch(() => {});
      const advance = () => setTimeout(onNext, POST_DELAY);
      const playAnswerThenAdvance = () => {
        bravo.pause();
        if (!ex.answerAudioDataUrl) {
          advance();
          return;
        }
        const ans = new Audio(ex.answerAudioDataUrl);
        ans.onended = advance;
        ans.play().catch(advance);
      };
      setTimeout(playAnswerThenAdvance, BRAVO_MS);
    } else {
      setFeedback("wrong");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div className="flex flex-col items-center gap-2 mb-6">
        <p className="font-bold text-center text-[#2d2d2d]">Remets les mots dans l&apos;ordre</p>
        <div className="flex items-center gap-3">
          <p dir="rtl" lang="ar" className="font-bold text-2xl text-[#2d2d2d]" style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}>
            رتِّب الكلمات
          </p>
          <button
            onClick={speakInstruction}
            aria-label="Écouter la consigne"
            className="w-10 h-10 rounded-full bg-[#f9a875]/10 hover:bg-[#f9a875]/20 flex items-center justify-center transition-colors shrink-0"
          >
            <Volume2 size={18} className="text-[#f9a875]" />
          </button>
        </div>
      </div>

      {/* Answer zone */}
      <div dir={isRTL ? "rtl" : "ltr"} className={`min-h-20 rounded-2xl border-2 border-dashed p-4 mb-4 flex flex-wrap items-center gap-2 transition-colors ${
        feedback === "correct" ? "border-[#95d5b2] bg-[#f0faf5]" :
        feedback === "wrong"   ? "border-[#ff8fa3] bg-[#fff0f3]" :
        "border-gray-200 bg-gray-50/50"
      } ${shake ? "animate-wiggle" : ""}`}>
        {chosen.length === 0 ? (
          <span className="text-sm text-gray-400 italic mx-auto">Clique sur les mots ci-dessous</span>
        ) : (
          chosen.map((c) => (
            <button key={c.id} onClick={() => removeFromChosen(c.id)}
              disabled={feedback === "correct"}
              className="px-3 py-1.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-default transition"
              style={{ background: color }}>
              {c.word}
            </button>
          ))
        )}
      </div>

      {/* Pool */}
      <div dir={isRTL ? "rtl" : "ltr"} className="flex flex-wrap gap-2 justify-center mb-6 min-h-12">
        {pool.map((p) => (
          <button key={p.id} onClick={() => pickFromPool(p.id)}
            className="px-3 py-1.5 rounded-xl text-sm font-bold border-2 border-gray-200 bg-white text-[#2d2d2d] hover:bg-gray-50 transition"
            style={{ borderColor: `${color}60` }}>
            {p.word}
          </button>
        ))}
      </div>

      {/* Validate */}
      <button onClick={validate}
        disabled={chosen.length !== targetWords.length || feedback === "correct" || targetWords.length === 0}
        className="w-full py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{ background: color }}>
        {feedback === "correct" ? (<><CheckCircle size={16} /> Bravo !</>) : "Vérifier"}
      </button>
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
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <p className="font-bold text-center text-[#2d2d2d] mb-6">Associe les paires</p>
      <div className="space-y-3">
        {ex.pairs.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <div className="flex-1 bg-[#fff8ee] rounded-xl px-4 py-2 text-sm font-semibold text-center">{p.left}</div>
            <span className="text-gray-400">↔</span>
            <div className="flex-1 bg-[#f0faf5] rounded-xl px-4 py-2 text-sm font-semibold text-center">{p.right}</div>
          </div>
        ))}
      </div>
      <button onClick={() => { track.view(); onNext(); }}
        className="mt-6 w-full py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
        style={{ background: color }}>
        Continuer <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function DragDropRenderer({ ex, color, onNext, lessonId, blockId }: {
  ex: DragExercise; color: string; onNext: () => void; lessonId: string; blockId: string;
}) {
  const track = useExerciseTracker({ lessonId, blockId, exerciseType: "dragdrop" });
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <p className="font-bold text-center text-[#2d2d2d] mb-6">Classe les éléments</p>
      <div className="flex gap-3 flex-wrap justify-center mb-4">
        {ex.items.map((item) => (
          <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold">
            {item.text}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {ex.categories.map((cat) => (
          <div key={cat.id} className="flex-1 rounded-2xl border-2 border-dashed border-gray-300 p-4 text-center">
            <p className="font-bold text-sm text-gray-600">{cat.label}</p>
          </div>
        ))}
      </div>
      <button onClick={() => { track.view(); onNext(); }}
        className="mt-6 w-full py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
        style={{ background: color }}>
        Continuer <ChevronRight size={16} />
      </button>
    </div>
  );
}

