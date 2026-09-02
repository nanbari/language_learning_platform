"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, BookOpen } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { fetchLessons, type ApiLesson } from "@/lib/lessonsApi";

const LESSON_COLORS = ["#BB908E", "#8BA3B1", "#999B84", "#CCB9B5", "#7B868E", "#6B705C"];
const LESSON_EMOJIS = ["📖", "🌟", "🐾", "🔢", "🎨", "🌿", "🌙", "🦁"];

function countExercises(lesson: { blocks: { type: string }[] }): number {
  return lesson.blocks.filter((b) => b.type === "exercise").length;
}

export default function StudentPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [lessons, setLessons] = useState<ApiLesson[]>([]);

  useEffect(() => {
    fetchLessons().then(setLessons).catch(() => setLessons([]));
  }, []);

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
        <div className="rounded-3xl p-8 text-white mb-8 relative overflow-hidden" style={{ background: "#BB908E" }}>
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

        <div>
          <h2 className="text-xl font-black text-[#2D2D2D] mb-4 flex items-center gap-2">
            <BookOpen size={20} style={{ color: "#BB908E" }} /> Mes leçons
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
