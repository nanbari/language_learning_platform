"use client";
/**
 * Révision personnalisée d'une leçon.
 *
 * POST /api/practice construit une série ciblée sur les exercices que
 * l'élève a ratés (rejoués tels quels par défaut, ou générés par l'agent en
 * mode claude) ; ils sont joués ici avec les mêmes rendus que la leçon, et
 * leurs événements se journalisent sous la leçon d'origine.
 */
import { useState, use, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Trophy, Sparkles, RefreshCw } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { fetchLessons, type ApiLesson } from "@/lib/lessonsApi";
import { fetchLatestPracticeSet, generatePractice, fetchPracticeSummary } from "@/lib/practiceApi";
import type { PracticeSet } from "@/lib/practice";
import {
  QuizRenderer, WordOrderRenderer,
  type QuizExercise, type WordOrderExercise,
} from "@/components/lesson/ExerciseRenderers";

// Même rotation que le tableau de bord et la page de leçon.
const COLORS = ["#8BA3B1", "#999B84", "#6B705C", "#BB908E", "#7B868E", "#CCB9B5"];

type Phase =
  | { kind: "loading" }
  | { kind: "intro" }                       // aucune série : proposer d'en préparer une
  | { kind: "generating" }
  | { kind: "nothing" }                     // rien de raté sur cette leçon
  | { kind: "empty" }                       // le modèle n'a rien produit d'exploitable
  | { kind: "error"; message: string }
  | { kind: "playing"; set: PracticeSet }
  | { kind: "done"; set: PracticeSet };

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lesson, setLesson] = useState<ApiLesson | null | "loading">("loading");
  const [color,  setColor]  = useState(COLORS[0]);
  const [phase,  setPhase]  = useState<Phase>({ kind: "loading" });
  const [index,  setIndex]  = useState(0);
  // Nombre d'exercices ratés sur la leçon (null = inconnu), pour l'écran d'accueil.
  const [failed, setFailed] = useState<number | null>(null);
  const { score, resetGame } = useGameStore();

  useEffect(() => {
    (async () => {
      const all = await fetchLessons().catch(() => [] as ApiLesson[]);
      const idx = all.findIndex((l) => l.id === id);
      setLesson(idx >= 0 ? all[idx] : null);
      if (idx >= 0) setColor(COLORS[idx % COLORS.length]);
      if (idx < 0) { setPhase({ kind: "error", message: "Leçon introuvable" }); return; }
      const [set, summary] = await Promise.all([
        fetchLatestPracticeSet(id).catch(() => null),
        fetchPracticeSummary().catch(() => []),
      ]);
      setFailed(summary.find((s) => s.lessonId === id)?.toReview ?? 0);
      setPhase(set && set.blocks.length > 0 ? { kind: "playing", set } : { kind: "intro" });
    })();
  }, [id]);

  const generate = useCallback(async () => {
    setPhase({ kind: "generating" });
    try {
      const result = await generatePractice(id);
      if (result.status === "created") { setIndex(0); resetGame(); setPhase({ kind: "playing", set: result.set }); }
      else if (result.status === "nothing_to_review") setPhase({ kind: "nothing" });
      else setPhase({ kind: "empty" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Erreur inattendue" });
    }
  }, [id, resetGame]);

  const title = lesson && lesson !== "loading" ? lesson.title : "";

  const nav = (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <Link href="/student" className="flex items-center gap-2 text-gray-600 hover:text-[#6B705C] transition-colors">
        <ArrowLeft size={18} /> Retour
      </Link>
      <p className="font-black text-[#2d2d2d] text-sm truncate max-w-[200px]">
        <Sparkles size={14} className="inline mr-1 -mt-0.5" style={{ color }} />
        Révision · {title}
      </p>
      <div className="flex items-center gap-1 font-bold text-[#999B84]">
        <Star size={14} fill="#999B84" /> {score}
      </div>
    </div>
  );

  const card = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#fffef9] flex flex-col">
      {nav}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center bg-white rounded-3xl p-8 shadow-sm border border-gray-100 animate-bounce-in">
          {children}
        </div>
      </div>
    </div>
  );

  if (phase.kind === "loading" || lesson === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-float">⏳</div></div>;
  }

  if (phase.kind === "error") {
    return card(<>
      <div className="text-5xl mb-4">😅</div>
      <p className="text-xl font-black text-[#2d2d2d] mb-2">Oups</p>
      <p className="text-gray-600 mb-6">{phase.message}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={generate} className="px-5 py-3 rounded-full border-2 font-bold hover:opacity-80 transition-all" style={{ borderColor: color, color }}>
          Réessayer
        </button>
        <Link href="/student" className="px-5 py-3 rounded-full text-white font-bold hover:opacity-90 transition-all" style={{ background: color }}>
          Tableau de bord
        </Link>
      </div>
    </>);
  }

  if (phase.kind === "intro") {
    return card(<>
      <div className="text-6xl mb-4">✨</div>
      <h1 className="text-2xl font-black text-[#2d2d2d] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
        Ta révision sur mesure
      </h1>
      <p className="text-gray-600 mb-6">
        {failed !== null && failed > 0 ? (
          <>Tu n&apos;as pas réussi <strong>{failed} exercice{failed > 1 ? "s" : ""}</strong> du premier coup dans <strong>{title}</strong>. On les rejoue ensemble pour t&apos;entraîner !</>
        ) : (
          <>Je rassemble les exercices que tu as ratés dans <strong>{title}</strong> pour que tu les rejoues.</>
        )}
      </p>
      <button onClick={generate}
        className="w-full py-4 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] transition-all"
        style={{ background: color }}>
        <Sparkles size={20} /> Préparer ma révision
      </button>
    </>);
  }

  if (phase.kind === "generating") {
    return card(<>
      <div className="text-6xl mb-4 animate-float">🧠</div>
      <p className="text-xl font-black text-[#2d2d2d] mb-2">Je prépare tes exercices…</p>
      <p className="text-gray-500 text-sm">Un instant.</p>
    </>);
  }

  if (phase.kind === "nothing") {
    return card(<>
      <div className="text-6xl mb-4">🌟</div>
      <p className="text-xl font-black text-[#2d2d2d] mb-2">Rien à revoir !</p>
      <p className="text-gray-600 mb-6">Tu as réussi tous les exercices de cette leçon du premier coup. Bravo !</p>
      <Link href="/student" className="inline-block px-6 py-3 rounded-full text-white font-bold hover:opacity-90 transition-all" style={{ background: color }}>
        Tableau de bord
      </Link>
    </>);
  }

  if (phase.kind === "empty") {
    return card(<>
      <div className="text-6xl mb-4">🤔</div>
      <p className="text-xl font-black text-[#2d2d2d] mb-2">Pas d&apos;exercice cette fois</p>
      <p className="text-gray-600 mb-6">Je n&apos;ai pas réussi à préparer d&apos;exercices. Tu peux rejouer la leçon ou réessayer plus tard.</p>
      <div className="flex gap-3 justify-center">
        <Link href={`/student/lesson/${id}`} className="px-5 py-3 rounded-full border-2 font-bold hover:opacity-80 transition-all" style={{ borderColor: color, color }}>
          Rejouer la leçon
        </Link>
        <Link href="/student" className="px-5 py-3 rounded-full text-white font-bold hover:opacity-90 transition-all" style={{ background: color }}>
          Tableau de bord
        </Link>
      </div>
    </>);
  }

  if (phase.kind === "done") {
    return card(<>
      <div className="text-7xl mb-4">🏆</div>
      <h1 className="text-3xl font-black text-[#2d2d2d] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>Bien joué !</h1>
      <p className="text-gray-600 mb-6">Tu as terminé ta révision de <strong>{title}</strong>.</p>
      <div className="rounded-2xl p-5 text-white mb-6" style={{ background: color }}>
        <div className="flex items-center justify-center gap-3 text-2xl font-black">
          <Star fill="white" size={22} /> {score} points !
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <button onClick={generate}
          className="w-full py-3 rounded-full border-2 font-bold flex items-center justify-center gap-2 hover:opacity-80 transition-all"
          style={{ borderColor: color, color }}>
          <RefreshCw size={16} /> Nouvelle série
        </button>
        <Link href="/student"
          className="w-full py-3 rounded-full text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
          style={{ background: color }}>
          <Trophy size={16} /> Tableau de bord
        </Link>
      </div>
    </>);
  }

  // phase.kind === "playing"
  const { set } = phase;
  const block = set.blocks[index];
  const advance = () => {
    if (index < set.blocks.length - 1) setIndex(index + 1);
    else setPhase({ kind: "done", set });
  };
  const ex = block.exercise;

  return (
    <div className="min-h-screen bg-[#fffef9] flex flex-col">
      {nav}
      <div className="flex-1 flex flex-col justify-center w-full max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white"
            style={{ background: color }}>
            <Sparkles size={14} /> Révision · {index + 1}/{set.blocks.length}
          </div>
        </div>

        {ex.type === "quiz" && (
          <QuizRenderer
            key={block.id}
            ex={ex as QuizExercise}
            color={color}
            onNext={advance}
            idx={index}
            total={set.blocks.length}
            lessonId={set.lessonId}
            blockId={block.id}
          />
        )}

        {ex.type === "wordorder" && (
          <WordOrderRenderer
            key={block.id}
            ex={ex as WordOrderExercise}
            color={color}
            onNext={advance}
            lessonId={set.lessonId}
            blockId={block.id}
          />
        )}

        {ex.type !== "quiz" && ex.type !== "wordorder" && (
          <div className="text-center">
            <button onClick={advance} className="px-6 py-3 rounded-full text-white font-bold" style={{ background: color }}>
              Continuer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
