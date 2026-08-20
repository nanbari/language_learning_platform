import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ContactSection from "@/components/sections/ContactSection";
import Link from "next/link";
import {
  ArrowRight, Sparkles, Monitor, Users, Star, Clock,
  Leaf, Award,
} from "lucide-react";

/* ─── Décorations SVG réutilisables ─────────────────────────────────── */

function Arches({ className = "" }: { className?: string }) {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none" className={className}>
      <rect x="2"  y="44" width="26" height="24" rx="4" stroke="#BB908E" strokeWidth="3"/>
      <rect x="37" y="30" width="26" height="38" rx="4" stroke="#8BA3B1" strokeWidth="3"/>
      <rect x="72" y="10" width="26" height="58" rx="4" stroke="#999B84" strokeWidth="3.5"/>
      <text x="4" y="14" fontSize="12" fill="#999B84">★</text>
    </svg>
  );
}

/* ─── Données ────────────────────────────────────────────────────────── */

const programs = [
  {
    name: "Maths en présentiel", age: "3–12 ans · Individuel", color: "#BB908E", bg: "#F5EEEE",
    format: "Présentiel",
    schedule: "Horaire à convenir",
    teachers: "Cours particulier",
    capacity: "1 élève",
    desc: "Un accompagnement individuel en mathématiques pour les enfants de 3 à 12 ans. Chaque séance est construite sur mesure, avec du matériel concret et une progression qui respecte le rythme de l'enfant.",
    subjects: ["Manipulation concrète", "Progression sur mesure", "Confiance retrouvée"],
    price: "25 €/h ou 40 €/2h",
  },
  {
    name: "Maths ados — Individuel", age: "12–15 ans · En ligne", color: "#8BA3B1", bg: "#EAF0F4",
    format: "En ligne",
    schedule: "Horaire à convenir",
    teachers: "Cours particulier",
    capacity: "1 élève",
    desc: "Un suivi individuel en visio pour collégiens de 12 à 15 ans. Rythme intensif, objectifs sur mesure, pour combler les lacunes ou préparer un examen important.",
    subjects: ["Soutien scolaire", "Préparation aux examens", "Méthodologie"],
    price: "30 €/h ou 50 €/2h",
  },
  {
    name: "Préparation au CE1D", age: "12–15 ans · En ligne", color: "#6B705C", bg: "#ECEEE9",
    format: "En ligne",
    schedule: "Samedi, 11h–12h30",
    teachers: "Cours collectif",
    capacity: "6 élèves max",
    desc: "Un cours collectif hebdomadaire dédié à la préparation du CE1D en mathématiques, de septembre à juin. Chaque samedi matin, on revoit les notions clés, on s'entraîne sur des épreuves types et on travaille la méthodologie, ensemble.",
    subjects: ["Épreuves types", "Méthodologie", "Septembre à juin"],
    price: "40 €/mois",
  },
];

const pillars = [
  {
    icon: Leaf,
    color: "#6B705C", // moss — végétal, croissance
    title: "Pédagogie Montessori",
    desc: "Manipulation concrète avant abstraction : matériel sensoriel, mise en situation et construction progressive du sens — l'esprit mathématique prend racine dans les doigts avant les chiffres.",
  },
  {
    icon: Sparkles,
    color: "#8BA3B1", // slate
    title: "Progression sur mesure",
    desc: "Chaque élève avance à son rythme, avec un parcours construit à partir de ses acquis et de ses difficultés — pas de programme rigide, mais un cap clair.",
  },
  {
    icon: Users,
    color: "#BB908E", // blush — chaleur de l'échange
    title: "Suivi personnalisé",
    desc: "Attention complète en tête-à-tête pour les 3-12 ans, petits groupes en ligne pour les ados : chaque question trouve sa réponse, chaque blocage son détour.",
  },
  {
    icon: Award,
    color: "#999B84", // sage — confiance
    title: "Cadre bienveillant",
    desc: "Se réconcilier avec les maths, c'est d'abord leur rendre leur beauté. Beaucoup d'encouragement, du temps pour chaque question, et la fierté de comprendre par soi-même.",
  },
];

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="overflow-hidden">

        {/* ── 1. Hero ─────────────────────────────────────────────────── */}
        <section className="relative bg-[#F5EEE6] py-24 lg:py-32 px-4 overflow-hidden">
          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-[0.13] pointer-events-none hidden lg:block">
            <svg width="240" height="280" viewBox="0 0 100 70" fill="none">
              <text x="4" y="14" fontSize="12" fill="#999B84">★</text>
              <rect x="2"  y="44" width="26" height="24" rx="4" stroke="#BB908E" strokeWidth="3"/>
              <rect x="37" y="30" width="26" height="38" rx="4" stroke="#8BA3B1" strokeWidth="3"/>
              <rect x="72" y="10" width="26" height="58" rx="4" stroke="#999B84" strokeWidth="3.5"/>
            </svg>
          </div>

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="flex justify-start mb-4 fade-up" style={{ animationDelay: "0ms" }}>
              <Arches />
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-[#2D2D2D] leading-tight mb-3 fade-up" style={{ fontFamily: "'Fredoka One', cursive", animationDelay: "120ms" }}>
              Monte <span style={{ color: "#2D2D2D" }}>&</span> So<span style={{ color: "#BB908E" }}>u</span>ri<span style={{ color: "#999B84" }}>s</span>
            </h1>

            <p
              className="relative inline-block text-2xl lg:text-3xl text-[#2D2D2D]/70 mb-8 fade-up"
              style={{ fontFamily: "'Caveat', cursive", animationDelay: "240ms" }}
            >
              Les maths, à ton rythme&nbsp;♡
              <svg
                aria-hidden
                width="240" height="14" viewBox="0 0 240 14" fill="none"
                className="absolute -bottom-2 left-0 pointer-events-none"
              >
                <path
                  d="M3,8 Q60,2 118,7 T237,5"
                  stroke="#999B84" strokeWidth="2.5" strokeLinecap="round" opacity="0.55"
                  className="draw-underline"
                />
              </svg>
            </p>

            <p
              className="text-lg text-[#2D2D2D]/60 mb-8 leading-relaxed max-w-2xl fade-up"
              style={{ animationDelay: "360ms" }}
            >
              Monte & Souris, c'est un accompagnement en mathématiques inspiré de la pédagogie Montessori. Cours particuliers en présentiel pour les 3-12 ans, et soutien en ligne pour les ados de 12 à 15 ans — avec du matériel concret et la fierté de comprendre par soi-même.
            </p>

            <div className="flex flex-wrap gap-3 fade-up" style={{ animationDelay: "480ms" }}>
              <a
                href="#courses"
                className="group px-7 py-3 rounded-full font-bold text-white shadow hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                style={{ background: "#8BA3B1" }}
              >
                Découvrir nos cours
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <Link
                href="/login"
                className="px-7 py-3 rounded-full font-bold text-[#2D2D2D]/75 border border-[#2D2D2D]/20 hover:bg-[#2D2D2D]/5 hover:text-[#2D2D2D] transition-all flex items-center gap-2 text-sm"
              >
                Je suis élève · Accès plateforme <Sparkles size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 2. Nos cours ────────────────────────────────────────────── */}
        <section id="courses" className="scroll-mt-20 py-24 px-4 bg-[#FFFDF8]">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Nos cours
            </h2>
            <p className="text-[#2D2D2D]/55 text-lg">
              Trois formules, un même cadre : suivi sur mesure, matériel concret, plateforme de révision incluse.
            </p>
          </div>

          <div className="max-w-6xl mx-auto space-y-12">
            {programs.map((p, i) => (
              <div key={p.name} className={`group flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 items-center`}>
                <div className="flex-1 w-full">
                  <div
                    className="rounded-3xl p-8 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.18)]"
                    style={{ background: p.bg, border: `2px solid ${p.color}30` }}
                  >
                    <div className="inline-block text-xs font-bold rounded-full px-3 py-1 mb-3 text-white" style={{ background: p.color }}>
                      {p.age}
                    </div>
                    <h3 className="text-2xl font-black text-[#2D2D2D] mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>
                      {p.name}
                    </h3>
                    <p className="text-[#2D2D2D]/60 leading-relaxed mb-4">{p.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {p.subjects.map((s) => (
                        <span key={s} className="text-xs rounded-full px-3 py-1 font-semibold text-white" style={{ background: `${p.color}cc` }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div
                    className="bg-[#F5EEE8] rounded-2xl p-5"
                    style={{ border: `1px solid ${p.color}33` }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60">
                        <Monitor size={16} style={{ color: "#BB908E" }} />{p.format} — {p.schedule}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60">
                        <Users size={16} style={{ color: "#6B705C" }} />{p.capacity}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60">
                        <Star size={16} style={{ color: "#999B84" }} />{p.teachers}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-black" style={{ color: p.color }}>
                        <Clock size={16} style={{ color: p.color }} />{p.price}
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/contact"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{ background: p.color }}
                  >
                    S'inscrire
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. Notre approche ───────────────────────────────────────── */}
        <section id="about" className="scroll-mt-20 py-24 px-4 bg-[#F5EEE6]">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Notre approche
            </h2>
            <p className="text-[#2D2D2D]/55 text-lg">
              Quatre principes au cœur de chaque séance.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pillars.map(({ icon: Icon, color, title, desc }, i) => (
              <div
                key={title}
                className="relative bg-[#FFFDF8] rounded-2xl p-6 shadow-sm border border-[#EDE5D8] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.18)]"
              >
                <span
                  aria-hidden
                  className="absolute top-3 right-4 leading-none select-none"
                  style={{ fontFamily: "'Caveat', cursive", fontSize: "1.6rem", color: `${color}80` }}
                >
                  {`0${i + 1}`}
                </span>
                <Icon size={22} className="mb-4" style={{ color }} strokeWidth={2} />
                <div
                  className="self-start rounded-full px-3 py-1 text-xs font-black text-white mb-3"
                  style={{ background: color }}
                >
                  {title}
                </div>
                <p className="text-[#2D2D2D]/65 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. Plateforme en ligne (réservée aux élèves) ────────────── */}
        <section className="py-24 px-4 relative overflow-hidden" style={{ background: "#2D2D2D" }}>
          <div className="absolute inset-0 flex items-end justify-between px-8 pb-0 opacity-20 pointer-events-none">
            <svg width="160" height="110" viewBox="0 0 160 110" fill="none">
              <path d="M4,108 Q80,4 156,108" stroke="#8BA3B1" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <svg width="160" height="110" viewBox="0 0 160 110" fill="none">
              <path d="M4,108 Q80,4 156,108" stroke="#6B705C" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center text-white">
            <div className="flex justify-center mb-5">
              <Arches className="opacity-60" />
            </div>

            <h2 className="text-3xl lg:text-4xl font-black mb-5" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Révisez en autonomie, à la maison
            </h2>

            <p className="text-white/65 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              La plateforme en ligne permet à chaque apprenant de pratiquer à son rythme, entre les séances.
              Exercices interactifs, suivi de progression et activités adaptées au niveau.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/login?role=student"
                className="px-7 py-3 rounded-full font-bold shadow hover:shadow-lg hover:scale-105 transition-all"
                style={{ background: "#BB908E", color: "#2D2D2D" }}
              >
                Accéder à la plateforme ★
              </Link>
              <Link
                href="/login?role=teacher"
                className="px-7 py-3 text-white rounded-full font-bold shadow-sm hover:shadow-md hover:scale-105 transition-all"
                style={{ background: "#8BA3B1" }}
              >
                Espace enseignant →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 5. Contact ──────────────────────────────────────────────── */}
        <ContactSection />

      </main>
      <Footer />
    </>
  );
}
