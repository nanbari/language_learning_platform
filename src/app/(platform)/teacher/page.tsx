"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, Users, BarChart2, Star, LogOut, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const LESSON_COLORS = ["#BB908E", "#8BA3B1", "#999B84", "#CCB9B5", "#7B868E", "#6B705C"];

interface SavedLesson { id: string; title: string; exercises?: unknown[]; blocks?: { type: string }[]; createdAt: string; }

// Les leçons récentes rangent tout dans `blocks` ; `exercises` n'existe que
// dans l'ancien format.
function countExercises(lesson: SavedLesson): number {
  if (lesson.blocks?.length) return lesson.blocks.filter((b) => b.type === "exercise").length;
  return lesson.exercises?.length ?? 0;
}

function TeacherPageInner() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("ms_lessons") || "[]");
    setSavedLessons(stored);
  }, []);

  useEffect(() => {
    if (params.get("published") === "1") {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
      router.replace("/teacher");
    }
  }, [params, router]);

  const deleteLesson = async (id: string) => {
    const { deleteLesson: del } = await import("@/lib/lessonStorage");
    await del(id);
    setSavedLessons((prev) => prev.filter((l) => l.id !== id));
  };

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    logout();
    router.push("/login");
  };

  const stats = [
    { label: "Leçons créées",    value: String(savedLessons.length), icon: BookOpen, color: "#BB908E" },
    { label: "Élèves actifs",    value: "28",  icon: Users,    color: "#6B705C" },
    { label: "Exercices joués",  value: "312", icon: Star,     color: "#999B84" },
    { label: "Taux de réussite", value: "84%", icon: BarChart2,color: "#8BA3B1" },
  ];

  return (
    <div className="min-h-screen bg-[#F5EEE8]">

      {/* Toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#2D2D2D] text-white px-5 py-3 rounded-2xl shadow-xl animate-bounce-in">
          <CheckCircle size={18} style={{ color: "#999B84" }} />
          <span className="font-bold">Leçon publiée avec succès !</span>
        </div>
      )}

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
          <div className="text-sm font-semibold text-[#2D2D2D]/70">{user?.name || "Enseignant"}</div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-[#2D2D2D]/50 hover:text-red-400 transition-colors">
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#2D2D2D]" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Bonjour, {user?.name?.split(" ")[0]} !
          </h1>
          <p className="text-[#2D2D2D]/50">Gérez vos leçons et suivez la progression de vos élèves</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#FFFDF8] rounded-2xl p-5 shadow-sm border border-[#EDE5D8]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#2D2D2D]/50">{label}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                  <Icon size={16} style={{ color }} />
                </div>
              </div>
              <div className="text-3xl font-black" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Leçons */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-[#2D2D2D]">Mes leçons</h2>
          <Link href="/teacher/create"
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm text-white hover:shadow-md hover:scale-105 transition-all"
            style={{ background: "#BB908E" }}>
            <Plus size={14} /> Nouvelle leçon
          </Link>
        </div>

        {savedLessons.length === 0 && (
          <p className="text-[#2D2D2D]/40 text-sm mb-4">Aucune leçon créée pour l&apos;instant.</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {savedLessons.map((lesson, idx) => {
            const color = LESSON_COLORS[idx % LESSON_COLORS.length];
            const exCount = countExercises(lesson);
            const date = new Date(lesson.createdAt).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
            return (
              <div key={lesson.id} className="ms-card bg-[#FFFDF8] border border-[#EDE5D8] overflow-hidden">
                <div className="h-2" style={{ background: color }} />
                <div className="p-5">
                  <h3 className="font-bold text-[#2D2D2D] mb-1">{lesson.title}</h3>
                  <p className="text-xs text-[#2D2D2D]/40 mb-3">{exCount} exercice{exCount > 1 ? "s" : ""} · {date}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => deleteLesson(lesson.id)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 transition-colors">
                      Supprimer
                    </button>
                    <Link href={`/teacher/create?edit=${lesson.id}`}
                      className="flex-1 text-center py-1.5 rounded-lg text-xs font-semibold border-2 transition-all hover:opacity-80"
                      style={{ borderColor: color, color }}>
                      Modifier
                    </Link>
                    <Link href={`/student/lesson/${lesson.id}`}
                      className="flex-1 text-center py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: color }}>
                      Aperçu
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add card */}
          <Link href="/teacher/create"
            className="ms-card border-2 border-dashed border-[#CCB9B5]/50 bg-[#F5EEE8]/50 flex flex-col items-center justify-center p-8 text-center hover:border-[#BB908E] transition-colors group">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform" style={{ background: "#CCB9B5" + "30" }}>
              <Plus size={24} style={{ color: "#BB908E" }} />
            </div>
            <p className="font-bold text-[#2D2D2D]/50 text-sm">Créer une leçon</p>
          </Link>
        </div>

        {/* Progress table */}
        <div className="mt-10 bg-[#FFFDF8] rounded-2xl shadow-sm border border-[#EDE5D8] overflow-hidden">
          <div className="p-5 border-b border-[#EDE5D8]">
            <h2 className="font-black text-[#2D2D2D]">Progression des élèves</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5EEE8]">
                <tr>
                  {["Élève", "Leçon", "Score", "Progression", "Dernière activité"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#2D2D2D]/40 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE5D8]">
                {[
                  { name: "Léa M.",   lesson: "Les chiffres", score: 90,  progress: 85,  date: "Aujourd'hui" },
                  { name: "Tom B.",   lesson: "L'alphabet",   score: 75,  progress: 60,  date: "Hier" },
                  { name: "Inès K.",  lesson: "Les animaux",  score: 100, progress: 100, date: "Aujourd'hui" },
                  { name: "Noah D.", lesson: "Les formes",   score: 60,  progress: 45,  date: "3 jours" },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-[#F5EEE8]/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#2D2D2D]">{row.name}</td>
                    <td className="px-4 py-3 text-[#2D2D2D]/60">{row.lesson}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: row.score >= 80 ? "#6B705C" : row.score >= 60 ? "#999B84" : "#BB908E" }}>{row.score}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24 h-2 bg-[#EDE5D8] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${row.progress}%`, background: "#BB908E" }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#2D2D2D]/35 text-xs">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5EEE8]"><div className="text-4xl animate-float">🌟</div></div>}>
      <TeacherPageInner />
    </Suspense>
  );
}
