"use client";
import { useState, use, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Trophy, Volume2, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { fetchLessons, type ApiLesson } from "@/lib/lessonsApi";
import { useExerciseTracker } from "@/lib/useExerciseTracker";

/* ── Types ── */
interface QuizOption { id: string; text: string; imageDataUrl?: string; }
interface QuizExercise {
  type: "quiz";
  question: string;
  options: QuizOption[];
  correctId: string;
  audioDataUrl?: string;
  answerMode: "image" | "text" | "both";
}
interface MatchPair { id: string; left: string; right: string; }
interface MatchExercise { type: "matching"; pairs: MatchPair[]; }
interface DragItem { id: string; text: string; category: string; }
interface DragCategory { id: string; label: string; }
interface DragExercise { type: "dragdrop"; items: DragItem[]; categories: DragCategory[]; }
interface WordOrderExercise { type: "wordorder"; sentence: string; audioDataUrl?: string; answerAudioDataUrl?: string; }
type Exercise = QuizExercise | MatchExercise | DragExercise | WordOrderExercise;
interface SlideItem { id: string; imageDataUrl: string; text?: string; audioDataUrl?: string; audioDuration?: number; }
interface VideoItem { id: string; url: string; title: string; }

type ContentBlock =
  | { id: string; type: "video";     url: string; title: string }
  | { id: string; type: "slideshow"; slides: SlideItem[] }
  | { id: string; type: "exercise";  exercise: Exercise }

interface StoredLesson {
  id: string; title: string; createdAt: string;
  blocks?: ContentBlock[];
  videos?: VideoItem[]; slideshow?: SlideItem[]; exercises?: Exercise[];
}

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0` : null;
}

// Only allow safe protocols when falling back to <video src>. Blocks javascript:, data:, etc.
function isSafeVideoUrl(url: string): boolean {
  try {
    const u = new URL(url, "http://x");
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "blob:";
  } catch { return false; }
}

function uid() { return Math.random().toString(36).slice(2, 8); }

function getLessonBlocks(lesson: StoredLesson): ContentBlock[] {
  if (lesson.blocks?.length) return lesson.blocks;
  const blocks: ContentBlock[] = [];
  for (const v of lesson.videos ?? []) blocks.push({ id: v.id, type: "video", url: v.url, title: v.title });
  if (lesson.slideshow?.length) blocks.push({ id: uid(), type: "slideshow", slides: lesson.slideshow });
  for (const ex of lesson.exercises ?? []) blocks.push({ id: uid(), type: "exercise", exercise: ex });
  return blocks;
}

// Même ordre que LESSON_COLORS du tableau de bord : la leçon garde la
// couleur de sa carte.
const COLORS = ["#8BA3B1", "#999B84", "#6B705C", "#BB908E", "#7B868E", "#CCB9B5"];

/* ── Slideshow renderer ── */
function SlideshowRenderer({ slides, onDone }: { slides: SlideItem[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const audioBufsRef   = useRef<(AudioBuffer | null)[]>([]);
  const decodingRef    = useRef<Promise<void>[]>([]);
  const sourceRef      = useRef<AudioBufferSourceNode | null>(null);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decode all audio into memory once — keeps a promise per slide so the
  // playback effect can await decode completion before starting.
  useEffect(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    audioBufsRef.current = new Array(slides.length).fill(null);

    decodingRef.current = slides.map((slide, i) => {
      if (!slide.audioDataUrl) return Promise.resolve();
      return fetch(slide.audioDataUrl)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => { audioBufsRef.current[i] = buf; })
        .catch(() => {});
    });

    return () => {
      sourceRef.current?.stop();
      ctx.close();
    };
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
    let cancelled  = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    sourceRef.current?.stop();
    sourceRef.current = null;

    const playAndSchedule = () => {
      if (cancelled) return;
      const ctx = audioCtxRef.current;
      const buf = audioBufsRef.current[idx];
      if (ctx && buf) {
        if (ctx.state === "suspended") ctx.resume();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        sourceRef.current = src;
      }
      timerRef.current = setTimeout(advance, duration);
    };

    // Wait for decode to finish before playing — fixes cut beginning on first slides
    (decodingRef.current[idx] ?? Promise.resolve()).then(playAndSchedule);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      sourceRef.current?.stop();
      sourceRef.current = null;
    };
  }, [idx, advance, slides]);

  const slide = slides[idx];

  return (
    <div className="min-h-screen bg-[#fffef9] flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-400">{idx + 1} / {slides.length}</span>
          <span className="text-xs text-gray-400 font-semibold">Leçon illustrée</span>
        </div>
        {(slide.imageDataUrl || slide.text) && (
          <div className="rounded-3xl overflow-hidden shadow-lg border border-gray-100 bg-white">
            {slide.imageDataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={slide.imageDataUrl}
                alt={`Diapo ${idx + 1}`}
                className="w-full object-contain max-h-[65vh]"
              />
            )}
            {slide.text && (
              <p className="px-6 py-4 text-center text-lg font-semibold text-[#2d2d2d] leading-relaxed whitespace-pre-line">
                {slide.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Quiz renderer — handles image / text / both
───────────────────────────────────────────── */
function QuizRenderer({ ex, color, onNext, idx, total, lessonId, blockId }: {
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
function WordOrderRenderer({ ex, color, onNext, lessonId, blockId }: {
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
function MatchingRenderer({ ex, color, onNext, lessonId, blockId }: {
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

function DragDropRenderer({ ex, color, onNext, lessonId, blockId }: {
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

/* ─────────────────────────────────────────────
   Main lesson page
───────────────────────────────────────────── */
export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lesson,     setLesson]     = useState<StoredLesson | null | "loading">("loading");
  const [allLessons, setAllLessons] = useState<ApiLesson[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [completed,  setCompleted]  = useState(false);
  const { score, resetGame } = useGameStore();

  useEffect(() => {
    (async () => {
      const all = await fetchLessons().catch(() => [] as ApiLesson[]);
      setAllLessons(all);
      const found = all.find((l) => l.id === id);
      setLesson((found as unknown as StoredLesson) ?? null);
    })();
  }, [id]);

  if (lesson === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-float">⏳</div></div>;
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-black mb-4">Leçon introuvable 😅</p>
          <Link href="/student" className="text-[#8BA3B1] hover:underline">← Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }

  const lessonIdx = allLessons.findIndex((l) => l.id === id);
  const color = COLORS[lessonIdx >= 0 ? lessonIdx % COLORS.length : 0];

  const blocks = getLessonBlocks(lesson);
  const currentBlock = blocks[blockIndex] ?? null;

  const exerciseBlocks = blocks.filter((b) => b.type === "exercise");
  const exercisesDone  = blocks.slice(0, blockIndex).filter((b) => b.type === "exercise").length;

  const advanceBlock = () => {
    if (blockIndex < blocks.length - 1) setBlockIndex((i) => i + 1);
    else setCompleted(true);
  };

  /* ── Navbar shared ── */
  const nav = (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <Link href="/student" className="flex items-center gap-2 text-gray-600 hover:text-[#6B705C] transition-colors">
        <ArrowLeft size={18} /> Retour
      </Link>
      <p className="font-black text-[#2d2d2d] text-sm truncate max-w-[200px]">{lesson.title}</p>
      <div className="flex items-center gap-1 font-bold text-[#999B84]">
        <Star size={14} fill="#999B84" /> {score}
      </div>
    </div>
  );

  /* ── Completed screen ── */
  if (completed || !currentBlock) {
    return (
      <div className="min-h-screen bg-[#fffef9] flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-bounce-in">
          <div className="text-7xl mb-6">🏆</div>
          <h1 className="text-4xl font-black text-[#2d2d2d] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Félicitations !
          </h1>
          <p className="text-gray-600 mb-6">Tu as terminé <strong>{lesson.title}</strong> !</p>
          <div className="rounded-2xl p-6 text-white mb-8" style={{ background: color }}>
            <div className="flex items-center justify-center gap-3 text-2xl font-black mb-1">
              <Star fill="white" size={24} /> {score} points !
            </div>
            <p className="text-white/80 text-sm">Continue comme ça !</p>
          </div>
          <div className="flex gap-4 justify-center">
            <button onClick={() => { setCompleted(false); setBlockIndex(0); resetGame(); }}
              className="px-6 py-3 rounded-full border-2 font-bold hover:opacity-80 transition-all"
              style={{ borderColor: color, color }}>
              Rejouer
            </button>
            <Link href="/student"
              className="px-6 py-3 rounded-full text-white font-bold hover:shadow-lg transition-all flex items-center gap-2"
              style={{ background: color }}>
              <Trophy size={16} /> Tableau de bord
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Video block ── */
  if (currentBlock.type === "video") {
    const embedUrl = getYoutubeEmbedUrl(currentBlock.url);
    return (
      <div className="min-h-screen bg-[#fffef9] flex flex-col">
        {nav}
        <div className="flex-1 flex flex-col justify-center w-full max-w-4xl mx-auto px-4 py-8">
          {currentBlock.title && (
            <h2 className="text-xl font-black text-[#2d2d2d] mb-4 text-center">{currentBlock.title}</h2>
          )}
          <div className="rounded-3xl overflow-hidden shadow-md border border-gray-100 bg-black aspect-video mb-6">
            {embedUrl ? (
              <iframe src={embedUrl} className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
            ) : isSafeVideoUrl(currentBlock.url) ? (
              <video src={currentBlock.url} controls className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">
                URL vidéo invalide
              </div>
            )}
          </div>
          <button onClick={advanceBlock}
            className="w-full py-4 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] transition-all"
            style={{ background: color }}>
            Continuer <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  /* ── Slideshow block ── */
  if (currentBlock.type === "slideshow") {
    return (
      <div className="min-h-screen bg-[#fffef9]">
        {nav}
        <SlideshowRenderer key={blockIndex} slides={currentBlock.slides} onDone={advanceBlock} />
      </div>
    );
  }

  /* ── Exercise block ── */
  const ex = currentBlock.exercise;
  return (
    <div className="min-h-screen bg-[#fffef9] flex flex-col">
      {nav}
      <div className="flex-1 flex flex-col justify-center w-full max-w-2xl mx-auto px-4 py-10">
        {ex.type !== "wordorder" && (
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white mb-3"
              style={{ background: color }}>
              {ex.type === "quiz" ? "❓ Quiz"
                : ex.type === "matching" ? "🔗 Appariement"
                : "🗂️ Tri"}
              {exerciseBlocks.length > 1 && ` · ${exercisesDone + 1}/${exerciseBlocks.length}`}
            </div>
          </div>
        )}

        {ex.type === "quiz" && (
          <QuizRenderer
            key={blockIndex}
            ex={ex as QuizExercise}
            color={color}
            onNext={advanceBlock}
            idx={exercisesDone}
            total={exerciseBlocks.length}
            lessonId={lesson.id}
            blockId={currentBlock.id}
          />
        )}

        {ex.type === "matching" && (
          <MatchingRenderer
            key={blockIndex}
            ex={ex as MatchExercise}
            color={color}
            onNext={advanceBlock}
            lessonId={lesson.id}
            blockId={currentBlock.id}
          />
        )}

        {ex.type === "wordorder" && (
          <WordOrderRenderer
            key={blockIndex}
            ex={ex as WordOrderExercise}
            color={color}
            onNext={advanceBlock}
            lessonId={lesson.id}
            blockId={currentBlock.id}
          />
        )}

        {ex.type === "dragdrop" && (
          <DragDropRenderer
            key={blockIndex}
            ex={ex as DragExercise}
            color={color}
            onNext={advanceBlock}
            lessonId={lesson.id}
            blockId={currentBlock.id}
          />
        )}
      </div>
    </div>
  );
}
