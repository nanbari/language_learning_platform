import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ArabicHub() {
  return (
    <div className="min-h-screen bg-[#F5EEE8]">
      <div className="bg-[#FFFDF8] border-b border-[#EDE5D8] px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/student" className="flex items-center gap-2 text-[#2D2D2D]/50 hover:text-[#BB908E] transition-colors">
          <ArrowLeft size={18} /> Tableau de bord
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ background: "#BB908E" }}>م</div>
          <span className="font-black text-[#2D2D2D]" style={{ fontFamily: "'Fredoka One', cursive" }}>Monte & Souris</span>
        </div>
        <div className="w-20" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-5" style={{ background: "#CCB9B530", color: "#6B705C" }}>
            🌙 Pédagogie Montessori
          </div>
          <h1 className="text-5xl font-black text-[#2D2D2D] mb-3" style={{ fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
            تَعَلَّمِ العَرَبِيَّة
          </h1>
          <p className="text-lg font-semibold mb-1" style={{ fontFamily: "'Cairo', sans-serif", color: "#6B705C" }}>
            Apprends l'arabe
          </p>
          <p className="text-[#2D2D2D]/50 max-w-md mx-auto leading-relaxed">
            Explore la langue arabe à travers des activités Montessori : vocabulaire illustré, lettres sensorielles et exercices de lecture.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Link href="/arabic/vocabulary" className="group relative overflow-hidden rounded-3xl p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all" style={{ background: "#BB908E" }}>
            <div className="absolute -right-6 -top-6 text-[120px] opacity-20 group-hover:scale-110 transition-transform select-none">📖</div>
            <div className="relative">
              <div className="text-5xl mb-4">📖</div>
              <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>المُفْرَدَات</h2>
              <p className="text-white/80 font-semibold text-lg mb-1">Vocabulaire</p>
              <p className="text-white/70 text-sm mb-4">8 thèmes • Animaux, couleurs, famille, nourriture…</p>
              <div className="inline-flex items-center gap-2 bg-white/20 text-white rounded-full px-4 py-1.5 text-sm font-bold group-hover:bg-white/30 transition-colors">
                Commencer →
              </div>
            </div>
          </Link>

          <Link href="/arabic/reading" className="group relative overflow-hidden rounded-3xl p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all" style={{ background: "#8BA3B1" }}>
            <div className="absolute -right-6 -top-6 text-[120px] opacity-20 group-hover:scale-110 transition-transform select-none">🔤</div>
            <div className="relative">
              <div className="text-5xl mb-4">🔤</div>
              <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>الأَلِفْبَاء</h2>
              <p className="text-white/80 font-semibold text-lg mb-1">Alphabet</p>
              <p className="text-white/70 text-sm mb-4">28 lettres • Formes, sons et exemples</p>
              <div className="inline-flex items-center gap-2 bg-white/20 text-white rounded-full px-4 py-1.5 text-sm font-bold group-hover:bg-white/30 transition-colors">
                Commencer →
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { emoji: "🔤", value: "28", label: "lettres arabes" },
            { emoji: "🗂️", value: "8", label: "thèmes de vocabulaire" },
            { emoji: "📖", value: "90+", label: "mots illustrés" },
          ].map(({ emoji, value, label }) => (
            <div key={label} className="bg-[#FFFDF8] rounded-2xl p-5 text-center shadow-sm border border-[#EDE5D8]">
              <div className="text-3xl mb-2">{emoji}</div>
              <div className="text-2xl font-black" style={{ color: "#BB908E" }}>{value}</div>
              <div className="text-xs text-[#2D2D2D]/50 font-medium">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center opacity-20" style={{ fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
          <span className="text-6xl font-black" style={{ color: "#6B705C" }}>ب • ت • ث • ج • ح • خ</span>
        </div>
      </div>
    </div>
  );
}
