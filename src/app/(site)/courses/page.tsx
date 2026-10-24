import Link from "next/link";
import { Clock, Users, Star, ArrowRight } from "lucide-react";

const programs = [
  {
    emoji: "🌸", name: "Cours de langue en petit groupe", age: "À partir de 4 ans · En ligne", color: "#BB908E", bg: "#F5EEEE",
    schedule: "50 min par semaine",
    teachers: "Cours collectif",
    capacity: "6 élèves max",
    desc: "Des cours en direct, en visio, avec des leçons adaptées au niveau de chaque enfant. L'enseignante est certifiée Montessori et formée à la neurodiversité (TDAH, dyslexie, autisme). Entre deux cours, une plateforme adaptative permet de réviser seul.",
    subjects: ["Pédagogie Montessori", "Cours en direct", "Plateforme de révision", "Sans engagement", "Début le 15 novembre 2026"],
    price: "35 €/mois",
  },
];

const faqs = [
  { q: "Comment s'inscrire ?", a: "Remplissez le formulaire de demande d'inscription. Je vous recontacte ensuite pour proposer à votre enfant un groupe de son niveau." },
  { q: "Faut-il un niveau particulier ?", a: "Non. Les groupes sont formés selon le niveau des enfants : débutants complets ou enfants qui savent déjà lire un peu." },
  { q: "De quoi mon enfant a-t-il besoin ?", a: "Un ordinateur ou une tablette avec une connexion internet, une caméra et un micro. Le cours se rejoint d'un clic depuis l'espace élève." },
  { q: "Est-ce que je m'engage pour l'année ?", a: "Non. Le cours coûte 35 € par mois, sans engagement : vous pouvez arrêter à la fin de n'importe quel mois." },
];

export default function CoursesPage() {
  return (
    <div>
      <section className="bg-[#F5EEE8] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>Nos cours</h1>
          <p className="text-[#2D2D2D]/50 text-lg">Apprendre une langue autrement, en ligne, à partir de 4 ans</p>
        </div>
      </section>

      {/* Programs */}
      <section className="py-16 px-4 bg-[#FFFDF8]">
        <div className="max-w-6xl mx-auto space-y-10">
          {programs.map((p, i) => (
            <div key={p.name} className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 items-center`}>
              <div className="flex-1">
                <div className="rounded-3xl p-8" style={{ background: p.bg, border: `2px solid ${p.color}30` }}>
                  <div className="text-6xl mb-4">{p.emoji}</div>
                  <div className="inline-block text-xs font-bold rounded-full px-3 py-1 mb-3 text-white" style={{ background: p.color }}>{p.age}</div>
                  <h2 className="text-2xl font-black text-[#2D2D2D] mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>{p.name}</h2>
                  <p className="text-[#2D2D2D]/60 leading-relaxed mb-4">{p.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.subjects.map((s) => (
                      <span key={s} className="text-xs rounded-full px-3 py-1 font-semibold text-white" style={{ background: `${p.color}cc` }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="bg-[#F5EEE8] rounded-2xl p-5 border border-[#EDE5D8]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60"><Clock size={16} style={{ color: "#BB908E" }} />{p.schedule}</div>
                    <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60"><Users size={16} style={{ color: "#6B705C" }} />{p.capacity}</div>
                    <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60"><Star size={16} style={{ color: "#999B84" }} />{p.teachers}</div>
                    <div className="flex items-center gap-2 text-sm font-black" style={{ color: p.color }}><Clock size={16} style={{ color: p.color }} />{p.price}</div>
                  </div>
                </div>
                <Link href="/demande-inscription"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold transition-all hover:scale-105 hover:shadow-md"
                  style={{ background: p.color }}>
                  Demande d&apos;inscription <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-[#F5EEE8]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center text-[#2D2D2D] mb-10" style={{ fontFamily: "'Fredoka One', cursive" }}>Questions fréquentes</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-[#FFFDF8] rounded-2xl p-6 shadow-sm border border-[#EDE5D8]">
                <h3 className="font-bold text-[#2D2D2D] mb-2">❓ {q}</h3>
                <p className="text-[#2D2D2D]/55 text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
