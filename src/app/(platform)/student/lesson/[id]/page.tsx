"use client";
import { useState, use, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Trophy, ChevronRight, Sparkles } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { fetchLessons, type ApiLesson } from "@/lib/lessonsApi";
import { flushExerciseEvents } from "@/lib/eventsApi";
import { fetchPracticeSummary } from "@/lib/practiceApi";
import {
  QuizRenderer, WordOrderRenderer, MatchingRenderer, DragDropRenderer,
  type ContentBlock, type Exercise, type SlideItem, type VideoItem,
  type QuizExercise, type MatchExercise, type WordOrderExercise, type DragExercise,
} from "@/components/lesson/ExerciseRenderers";

/* ── Types ── */
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
   Main lesson page
───────────────────────────────────────────── */
export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lesson,     setLesson]     = useState<StoredLesson | null | "loading">("loading");
  const [allLessons, setAllLessons] = useState<ApiLesson[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [completed,  setCompleted]  = useState(false);
  // Exercices ratés sur cette leçon (null = pas encore calculé). Sert à ne
  // proposer la révision qu'à un élève qui a effectivement raté quelque chose.
  const [toReview,   setToReview]   = useState<number | null>(null);
  const { score, resetGame } = useGameStore();

  useEffect(() => {
    (async () => {
      const all = await fetchLessons().catch(() => [] as ApiLesson[]);
      setAllLessons(all);
      const found = all.find((l) => l.id === id);
      setLesson((found as unknown as StoredLesson) ?? null);
    })();
  }, [id]);

  // À la fin de la leçon, une fois les événements envoyés, on demande au
  // serveur ce que l'élève a raté pour lui proposer une révision ciblée.
  useEffect(() => {
    if (!completed) return;
    let cancelled = false;
    (async () => {
      await flushExerciseEvents();
      const summary = await fetchPracticeSummary().catch(() => []);
      if (cancelled) return;
      setToReview(summary.find((s) => s.lessonId === id)?.toReview ?? 0);
    })();
    return () => { cancelled = true; };
  }, [completed, id]);

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
          {exerciseBlocks.length > 0 && toReview !== null && toReview > 0 && (
            <Link href={`/student/practice/${lesson.id}`}
              className="mb-4 w-full px-6 py-3 rounded-full text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
              style={{ background: "#BB908E" }}>
              <Sparkles size={16} />
              Réviser ce que j&apos;ai raté ({toReview} exercice{toReview > 1 ? "s" : ""})
            </Link>
          )}
          {exerciseBlocks.length > 0 && toReview === 0 && (
            <p className="mb-4 text-sm font-semibold text-[#999B84]">
              ✨ Tout réussi du premier coup, rien à revoir !
            </p>
          )}
          <div className="flex gap-4 justify-center">
            <button onClick={() => { setCompleted(false); setToReview(null); setBlockIndex(0); resetGame(); }}
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
