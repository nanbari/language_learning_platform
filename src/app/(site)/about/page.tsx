import { Award, BookOpen, Heart, Users } from "lucide-react";

const steps = [
  {
    color: "#BB908E",
    title: "1. Prise de contact",
    desc: "Un premier échange (téléphone ou visio) pour comprendre les besoins de l'élève, ses difficultés et les objectifs des parents.",
  },
  {
    color: "#8BA3B1",
    title: "2. Séance découverte",
    desc: "Une première séance d'observation pour cerner les acquis et construire ensemble un parcours adapté — pas de plan rigide, un cap clair.",
  },
  {
    color: "#6B705C",
    title: "3. Séances régulières",
    desc: "Chaque séance combine manipulation, exercices progressifs et retours concrets. L'élève repart avec des repères et, très vite, plus de confiance.",
  },
  {
    color: "#999B84",
    title: "4. Suivi et bilan",
    desc: "Point régulier avec les parents pour suivre la progression, ajuster les objectifs et célébrer les victoires — petites ou grandes.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[#F5EEE8] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">🌳</div>
          <h1 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Notre approche
          </h1>
          <p className="text-[#2D2D2D]/55 text-lg max-w-2xl mx-auto leading-relaxed">
            Monte & Souris, c'est un accompagnement en mathématiques pour les enfants et les adolescents, inspiré de la pédagogie Montessori. L'objectif : leur rendre les maths claires, concrètes, et — pourquoi pas — leur apprendre à les aimer.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 bg-[#FFFDF8]">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block rounded-full px-4 py-1 text-sm font-semibold mb-4 text-white" style={{ background: "#CCB9B5" }}>Ma mission</div>
            <h2 className="text-3xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Réconcilier les élèves avec les mathématiques
            </h2>
            <p className="text-[#2D2D2D]/55 leading-relaxed mb-4">
              Trop d'élèves développent très tôt un rapport douloureux aux maths : blocages, perte de confiance, peur de se tromper. Pourtant, les mathématiques se découvrent d'abord avec les mains, les yeux et la curiosité — bien avant les symboles et les règles.
            </p>
            <p className="text-[#2D2D2D]/55 leading-relaxed">
              Ma mission, c'est de proposer un cadre bienveillant où chaque élève peut construire son propre rapport aux maths : par la manipulation, la compréhension profonde, et la fierté de comprendre par soi-même.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Heart,    color: "#BB908E", label: "Bienveillance" },
              { icon: Users,    color: "#8BA3B1", label: "Écoute" },
              { icon: BookOpen, color: "#6B705C", label: "Manipulation" },
              { icon: Award,    color: "#999B84", label: "Exigence" },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="bg-[#F5EEE8] rounded-2xl p-6 text-center border border-[#EDE5D8]">
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: `${color}25` }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <span className="font-bold text-[#2D2D2D]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parcours de l'élève */}
      <section className="py-16 px-4 bg-[#F5EEE8]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-center text-[#2D2D2D] mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>Comment ça se passe</h2>
          <p className="text-center text-[#2D2D2D]/50 mb-10">Un accompagnement en quatre temps, du premier contact au suivi régulier.</p>
          <div className="space-y-6">
            {steps.map(({ title, desc, color }) => (
              <div key={title} className="flex gap-4 items-start">
                <div className="w-3 h-3 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
                <div className="flex-1 bg-[#FFFDF8] rounded-xl p-5 shadow-sm border border-[#EDE5D8]">
                  <h3 className="font-black text-[#2D2D2D] mb-1" style={{ color }}>{title}</h3>
                  <p className="text-[#2D2D2D]/70 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
