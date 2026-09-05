"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, BookOpen, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { fetchLessons, type ApiLesson } from "@/lib/lessonsApi";
import { fetchPracticeSummary } from "@/lib/practiceApi";
import type { LessonReviewSummary } from "@/lib/weakSpots";

// Même ordre que COLORS de la page de leçon pour que la carte et la leçon
// partagent la couleur. Le rose n'ouvre pas la rotation — il domine déjà
// le logo et la charte l'entoure de Slate/Sage/Moss.
const LESSON_COLORS = ["#8BA3B1", "#999B84", "#6B705C", "#BB908E", "#7B868E", "#CCB9B5"];
const LESSON_EMOJIS = ["📖", "🌟", "🐾", "🔢", "🎨", "🌿", "🌙", "🦁"];

function countExercises(lesson: { blocks: { type: string }[] }): number {
  return lesson.blocks.filter((b) => b.type === "exercise").length;
}

export default function StudentPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [lessons, setLessons] = useState<ApiLesson[]>([]);
  // Leçons où l'élève a raté des exercices : la plateforme lui propose une
  // révision ciblée (voir /api/practice/summary). Vide tant que rien n'est raté.
  const [toReview, setToReview] = useState<LessonReviewSummary[]>([]);

  useEffect(() => {
    fetchLessons().then(setLessons).catch(() => setLessons([]));
    fetchPracticeSummary().then(setToReview).catch(() => setToReview([]));
  }, []);

  const reviewByLesson = new Map(toReview.map((s) => [s.lessonId, s.toReview]));
  const colorOf = (lessonId: string) => {
    const idx = lessons.findIndex((l) => l.id === lessonId);
    return LESSON_COLORS[(idx >= 0 ? idx : 0) % LESSON_COLORS.length];
  };
  const proposals = toReview
    .map((s) => ({ ...s, lesson: lessons.find((l) => l.id === s.lessonId) }))
    .filter((s): s is typeof s & { lesson: ApiLesson } => Boolean(s.lesson));

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#F5EEE8]">
      {/* Topbar */}
      <div className="bg-[#FFFDF8] border-b border-[#EDE5D8] px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/" className="flex items-end gap-2">
          <div className="relative w-8 h-8 flex items-end justify-center">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
              <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
              <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
              <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <p className="text-[10px] text-[#2D2D2D]/50 leading-none" style={{ fontFamily: "'Caveat', cursive" }}>
              ASBL
            </p>
            <span className="font-black text-[#2D2D2D] leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Monte <span className="text-[#2D2D2D]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-[#2D2D2D]/50 hover:text-red-400 transition-colors">
            <LogOut size={15} /> Sortir
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome hero */}
        <div className="rounded-3xl p-8 text-white mb-8 relative overflow-hidden" style={{ background: "#8BA3B1" }}>
          <div className="absolute right-6 top-4 opacity-20 pointer-events-none">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              <path d="M4,78 Q30,4 56,78" stroke="white" strokeWidth="4" strokeLinecap="round"/>
              <path d="M50,78 Q80,4 110,78" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black mb-1 relative z-10" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Bonjour, {user?.name?.split(" ")[0] || "Élève"} !
          </h1>
          <p className="text-white/75 relative z-10">Prêt·e à apprendre aujourd'hui ?</p>
        </div>

        {/* Révisions proposées d'après les exercices ratés */}
        {proposals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-black text-[#2D2D2D] mb-1 flex items-center gap-2">
              <Sparkles size={20} style={{ color: "#BB908E" }} /> À réviser
            </h2>
            <p className="text-sm text-[#2D2D2D]/50 mb-4">
              Des exercices que tu n&apos;as pas réussis du premier coup. Rejoue-les pour t&apos;entraîner !
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {proposals.map(({ lesson, toReview: n }) => {
                const color = colorOf(lesson.id);
                return (
                  <Link
                    key={lesson.id}
                    href={`/student/practice/${lesson.id}`}
                    className="ms-card bg-[#FFFDF8] border-2 p-4 flex items-center gap-3 hover:scale-[1.01] transition-all"
                    style={{ borderColor: `${color}60` }}
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                      style={{ background: color }}>
                      <Sparkles size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#2D2D2D] truncate">{lesson.title}</h3>
                      <p className="text-xs text-[#2D2D2D]/50">
                        {n} exercice{n > 1 ? "s" : ""} à revoir
                      </p>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color }}>Réviser →</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-black text-[#2D2D2D] mb-4 flex items-center gap-2">
            <BookOpen size={20} style={{ color: "#6B705C" }} /> Mes leçons
          </h2>
          <div className="space-y-4">
            {lessons.length === 0 && (
              <div className="bg-[#FFFDF8] rounded-2xl border-2 border-dashed border-[#EDE5D8] p-8 text-center text-[#2D2D2D]/40">
                <div className="text-4xl mb-2">📭</div>
                <p className="font-semibold text-sm">Aucune leçon disponible pour l&apos;instant.</p>
                <p className="text-xs mt-1">Ton enseignant n&apos;a pas encore publié de leçon.</p>
              </div>
            )}
            {lessons.map((lesson, idx) => {
              const color = LESSON_COLORS[idx % LESSON_COLORS.length];
              const emoji = LESSON_EMOJIS[idx % LESSON_EMOJIS.length];
              const exCount = countExercises(lesson);
              const failed  = reviewByLesson.get(lesson.id) ?? 0;
              return (
                <div key={lesson.id} className="ms-card bg-[#FFFDF8] border border-[#EDE5D8] overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ background: `${color}20` }}>
                      {emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#2D2D2D] truncate mb-0.5">{lesson.title}</h3>
                      <p className="text-xs text-[#2D2D2D]/40">
                        {exCount} exercice{exCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    {failed > 0 && (
                      <Link
                        href={`/student/practice/${lesson.id}`}
                        title={`${failed} exercice${failed > 1 ? "s" : ""} à revoir`}
                        className="relative flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 transition-all"
                        style={{ background: `${color}20`, color }}
                      >
                        <Sparkles size={16} />
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center"
                          style={{ background: "#BB908E" }}>
                          {failed}
                        </span>
                      </Link>
                    )}
                    <Link
                      href={`/student/lesson/${lesson.id}`}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition-all"
                      style={{ background: color }}
                    >
                      Commencer →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
