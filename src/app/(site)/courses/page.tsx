import Link from "next/link";
import { Clock, Users, Star, ArrowRight } from "lucide-react";

const programs = [
  {
    emoji: "🌸", name: "Maths en présentiel", age: "3–12 ans · Individuel", color: "#BB908E", bg: "#F5EEEE",
    schedule: "Horaire à convenir",
    teachers: "Cours particulier",
    capacity: "1 élève",
    desc: "Un accompagnement individuel en mathématiques pour les enfants de 3 à 12 ans. Chaque séance est construite sur mesure, avec du matériel concret et une progression qui respecte le rythme de l'enfant.",
    subjects: ["Manipulation concrète", "Numération & calcul", "Géométrie", "Résolution de problèmes", "Confiance retrouvée"],
    price: "25 €/h ou 40 €/2h",
  },
  {
    emoji: "🌿", name: "Maths ados — Individuel", age: "12–15 ans · En ligne", color: "#8BA3B1", bg: "#EAF0F4",
    schedule: "Horaire à convenir",
    teachers: "Cours particulier",
    capacity: "1 élève",
    desc: "Un suivi individuel en visio pour collégiens de 12 à 15 ans. Rythme intensif, objectifs sur mesure, pour combler les lacunes ou préparer un examen important.",
    subjects: ["Soutien scolaire", "Algèbre & géométrie", "Préparation aux examens", "Méthodologie", "Remise à niveau"],
    price: "30 €/h ou 50 €/2h",
  },
  {
    emoji: "🌊", name: "Préparation au CE1D", age: "12–15 ans · En ligne", color: "#6B705C", bg: "#ECEEE9",
    schedule: "Samedi, 11h–12h30",
    teachers: "Cours collectif",
    capacity: "6 élèves max",
    desc: "Un cours collectif hebdomadaire dédié à la préparation du CE1D en mathématiques, de septembre à juin. Chaque samedi matin, on revoit les notions clés, on s'entraîne sur des épreuves types et on travaille la méthodologie, ensemble.",
    subjects: ["Épreuves types", "Méthodologie", "Révision ciblée", "Septembre à juin", "1h30 chaque samedi"],
    price: "40 €/mois",
  },
];

const faqs = [
  { q: "Comment se déroule une première séance ?", a: "Un premier échange permet de faire le point sur les besoins, les difficultés et les objectifs de l'élève. La première séance sert ensuite à observer et à construire ensemble un parcours adapté." },
  { q: "Où ont lieu les cours en présentiel ?", a: "Les cours en présentiel pour les 3-12 ans se déroulent à domicile dans un rayon raisonnable. Contactez-moi pour vérifier si votre zone est couverte." },
  { q: "Quel outil est utilisé pour les cours en ligne ?", a: "Les cours en ligne pour les ados se font en visio avec un tableau blanc partagé, pour manipuler les objets mathématiques à distance comme en présentiel." },
  { q: "En quoi consiste la préparation au CE1D ?", a: "Chaque samedi de 11h à 12h30, de septembre à juin, en visio et par groupe de 6 maximum, on revoit les notions clés du programme, on s'entraîne sur des épreuves types et on travaille la méthodologie pour aborder l'examen sereinement." },
];

export default function CoursesPage() {
  return (
    <div>
      <section className="bg-[#F5EEE8] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>Nos cours</h1>
          <p className="text-[#2D2D2D]/50 text-lg">Trois formules pour apprendre les maths autrement, de 3 à 15 ans</p>
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
                <Link href="/contact"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold transition-all hover:scale-105 hover:shadow-md"
                  style={{ background: p.color }}>
                  S'inscrire <ArrowRight size={16} />
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
