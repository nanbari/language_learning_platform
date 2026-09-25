import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Clock, Compass, HeartHandshake, House, Laptop, Leaf, MapPin, Phone, Users,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Reveal from "@/components/home/Reveal";

/* ─── Styles partagés ──────────────────────────────────────────────────
   Formes : boutons et puces en pilule, conteneurs à 1.75rem.
   Accent unique : mousse (ms-moss). Icônes lucide, trait 1.75. */

const ICON = 1.75;

const btnPrimary =
  "inline-flex items-center gap-2 rounded-full bg-ms-moss px-6 py-3 text-sm font-bold text-ms-cream transition-all duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-14px_rgba(107,112,92,0.7)] active:translate-y-0 active:scale-[0.98]";
const btnGhost =
  "inline-flex items-center gap-2 rounded-full border border-ms-ink/15 px-6 py-3 text-sm font-bold text-ms-ink transition-all duration-300 ease-out-soft hover:border-ms-moss hover:text-ms-moss active:scale-[0.98]";
const btnOnMoss =
  "inline-flex items-center gap-2 rounded-full bg-ms-cream px-6 py-3 text-sm font-bold text-ms-moss transition-all duration-300 ease-out-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]";
const btnOnMossGhost =
  "inline-flex items-center gap-2 rounded-full border border-ms-cream/40 px-6 py-3 text-sm font-bold text-ms-cream transition-all duration-300 ease-out-soft hover:border-ms-cream hover:bg-ms-cream/10 active:scale-[0.98]";

/* ─── Données ────────────────────────────────────────────────────────── */

const facts = [
  { icon: Users,  text: "Élèves de 3 à 15 ans" },
  { icon: MapPin, text: "À domicile à Bruxelles ou en visio" },
  { icon: Laptop, text: "Plateforme de révision incluse" },
];

type Course = {
  name: string;
  age: string;
  desc: string;
  where: { icon: typeof House; text: string };
  group: string;
  price: string;
  image?: { src: string; alt: string };
  tone: "white" | "sand" | "moss";
};

const courses: Course[] = [
  {
    name: "Maths en présentiel",
    age: "3-12 ans, individuel",
    desc: "Un accompagnement individuel avec du matériel concret, construit sur mesure et au rythme de l'enfant.",
    where: { icon: House, text: "À domicile, horaire à convenir" },
    group: "1 élève",
    price: "25 €/h ou 40 €/2h",
    image: {
      // TODO photo réelle : enfant qui manipule du matériel Montessori (perles, barres), 1200x800
      src: "https://picsum.photos/seed/monte-souris-materiel/1200/800",
      alt: "Matériel Montessori de numération posé sur une table",
    },
    tone: "white",
  },
  {
    name: "Maths ados, individuel",
    age: "12-15 ans, en ligne",
    desc: "Un suivi individuel en visio pour combler les lacunes, préparer un examen ou retrouver une méthode de travail.",
    where: { icon: Laptop, text: "En visio, horaire à convenir" },
    group: "1 élève",
    price: "30 €/h ou 50 €/2h",
    tone: "sand",
  },
  {
    name: "Préparation au CE1D",
    age: "12-15 ans, en ligne",
    desc: "Un cours collectif hebdomadaire de septembre à juin : notions clés, épreuves types et méthodologie, ensemble.",
    where: { icon: Laptop, text: "En visio, le samedi de 11h à 12h30" },
    group: "6 élèves max",
    price: "40 €/mois",
    tone: "moss",
  },
];

const pillars = [
  {
    icon: Leaf,
    title: "Pédagogie Montessori",
    desc: "Manipuler avant d'abstraire : matériel sensoriel, mises en situation et construction progressive du sens.",
  },
  {
    icon: Compass,
    title: "Progression sur mesure",
    desc: "Chaque élève avance à son rythme, avec un parcours construit à partir de ses acquis et de ses difficultés. Un cap clair, sans programme rigide.",
  },
  {
    icon: Users,
    title: "Suivi personnalisé",
    desc: "Tête-à-tête pour les 3-12 ans, petits groupes en ligne pour les ados : chaque question trouve sa réponse.",
  },
  {
    icon: HeartHandshake,
    title: "Cadre bienveillant",
    desc: "Beaucoup d'encouragement, du temps pour chaque question, et la fierté de comprendre par soi-même.",
  },
];

/* ─── Cellule « cours » ──────────────────────────────────────────────── */

function CourseCell({ course, className = "" }: { course: Course; className?: string }) {
  const onMoss = course.tone === "moss";
  const surface =
    course.tone === "white" ? "bg-ms-white border border-ms-sand"
    : course.tone === "sand" ? "bg-ms-sand"
    : "bg-ms-moss text-ms-cream";
  const muted = onMoss ? "text-ms-cream/75" : "text-ms-ink/65";
  const chip  = onMoss ? "bg-ms-cream/15 text-ms-cream" : "bg-ms-moss/10 text-ms-moss";
  const Where = course.where.icon;

  return (
    <article className={`group flex flex-col overflow-hidden rounded-[1.75rem] ${surface} ${className}`}>
      {course.image && (
        <div className="relative aspect-[16/10] overflow-hidden bg-ms-sand">
          <Image
            src={course.image.src}
            alt={course.image.alt}
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-7 sm:p-8">
        <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${chip}`}>{course.age}</span>
        <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">{course.name}</h3>
        <p className={`mt-3 leading-relaxed ${muted}`}>{course.desc}</p>

        <ul className={`mt-6 space-y-2 text-sm ${muted}`}>
          <li className="flex items-center gap-2.5">
            <Where size={18} strokeWidth={ICON} className="shrink-0" />
            {course.where.text}
          </li>
          <li className="flex items-center gap-2.5">
            <Users size={18} strokeWidth={ICON} className="shrink-0" />
            {course.group}
          </li>
        </ul>

        <div className="mt-8 flex flex-1 flex-wrap items-end justify-between gap-4">
          <p className="font-display text-2xl font-semibold tracking-tight">{course.price}</p>
          <Link href="/contact" className={onMoss ? btnOnMoss : btnPrimary}>
            S’inscrire
            <ArrowRight size={16} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      <Header />
      <main>

        {/* ── Hero : texte à gauche, photo à droite ───────────────────── */}
        <section className="bg-ms-cream">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:pt-16 lg:pb-24">
            <Reveal className="lg:col-span-6">
              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ms-ink sm:text-5xl lg:text-[3.5rem]">
                Des maths qu’on comprend avec les mains.
              </h1>
              <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ms-ink/70">
                Cours particuliers inspirés de Montessori : à domicile à Bruxelles dès 3 ans, en visio pour les 12-15 ans.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#courses" className={btnPrimary}>
                  Découvrir les cours
                  <ArrowRight size={16} strokeWidth={2} />
                </a>
                <Link href="/login" className={btnGhost}>
                  Espace élève
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.15} className="lg:col-span-6">
              <div className="relative aspect-[5/4] max-h-[520px] overflow-hidden rounded-[1.75rem] bg-ms-sand lg:aspect-[4/5] lg:max-h-[calc(100dvh-12rem)]">
                {/* TODO photo réelle : séance de maths, enfant et enseignant autour du matériel, 1200x1500 */}
                <Image
                  src="https://picsum.photos/seed/monte-souris-seance/1200/1500"
                  alt="Un enfant manipule des perles de numération pendant une séance de mathématiques"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Repères : trois faits, filets fins ──────────────────────── */}
        <section className="border-y border-ms-sand bg-ms-white">
          <ul className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-ms-sand px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 py-5 text-sm font-semibold text-ms-ink/80 md:justify-center md:px-6">
                <Icon size={20} strokeWidth={ICON} className="shrink-0 text-ms-moss" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Nos cours : grille asymétrique 1 + 2 ─────────────────────── */}
        <section id="courses" className="scroll-mt-16 bg-ms-cream py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-[60ch]">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-ms-ink sm:text-4xl">
                Trois formules, un même cadre.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ms-ink/70">
                Suivi sur mesure, matériel concret et plateforme de révision incluse, quel que soit l’âge.
              </p>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Reveal className="lg:col-span-7 lg:row-span-2 flex">
                <CourseCell course={courses[0]} className="w-full" />
              </Reveal>
              <Reveal delay={0.08} className="lg:col-span-5 flex">
                <CourseCell course={courses[1]} className="w-full" />
              </Reveal>
              <Reveal delay={0.16} className="lg:col-span-5 flex">
                <CourseCell course={courses[2]} className="w-full" />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Notre approche : photo large puis quatre principes ──────── */}
        <section id="about" className="scroll-mt-16 bg-ms-white py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-[60ch]">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-ms-ink sm:text-4xl">
                Notre approche
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ms-ink/70">
                Quatre principes au cœur de chaque séance.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative mt-12 aspect-[16/9] overflow-hidden rounded-[1.75rem] bg-ms-sand sm:aspect-[21/9]">
                {/* TODO photo réelle : mains d'enfant sur du matériel Montessori, plan large, 1800x800 */}
                <Image
                  src="https://picsum.photos/seed/monte-souris-mains/1800/800"
                  alt="Des mains d'enfant alignent des barres de calcul Montessori"
                  fill
                  sizes="(min-width: 1152px) 1152px, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
              {pillars.map(({ icon: Icon, title, desc }, i) => (
                <Reveal key={title} delay={i * 0.06} className="border-t border-ms-sand pt-6">
                  <Icon size={24} strokeWidth={ICON} className="text-ms-moss" />
                  <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-ms-ink">{title}</h3>
                  <p className="mt-2 max-w-[48ch] leading-relaxed text-ms-ink/70">{desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Plateforme : bloc mousse, texte + capture ───────────────── */}
        <section className="bg-ms-cream py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="grid overflow-hidden rounded-[1.75rem] bg-ms-moss text-ms-cream lg:grid-cols-2">
                <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-14">
                  <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    Réviser en autonomie, entre deux séances.
                  </h2>
                  <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-ms-cream/80">
                    Exercices interactifs, suivi de progression et activités adaptées au niveau, accessibles depuis la maison.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/login?role=student" className={btnOnMoss}>
                      Espace élève
                      <ArrowRight size={16} strokeWidth={2} />
                    </Link>
                    <Link href="/login?role=teacher" className={btnOnMossGhost}>
                      Espace enseignant
                    </Link>
                  </div>
                </div>
                <div className="relative min-h-[260px] lg:min-h-full">
                  {/* TODO capture d'écran réelle de la plateforme (page élève), 1200x1000 */}
                  <Image
                    src="https://picsum.photos/seed/monte-souris-plateforme/1200/1000"
                    alt="La plateforme de révision Monte & Souris ouverte sur un ordinateur portable"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <section id="contact" className="scroll-mt-16 border-t border-ms-sand bg-ms-white py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-ms-ink sm:text-4xl">
                Une question ? Écrivez-moi.
              </h2>
              <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ms-ink/70">
                Inscription, disponibilités ou simple curiosité : je réponds sous 48h.
              </p>
              <a
                href="mailto:nabilaanbari@zohomail.eu"
                className="mt-8 inline-block break-all font-display text-xl font-semibold text-ms-moss underline decoration-ms-moss/30 underline-offset-8 transition-colors hover:decoration-ms-moss sm:text-2xl"
              >
                nabilaanbari@zohomail.eu
              </a>
            </Reveal>

            <Reveal delay={0.1} className="lg:col-span-5 lg:pt-2">
              <ul className="divide-y divide-ms-sand text-ms-ink/80">
                <li className="flex items-start gap-3 py-4">
                  <MapPin size={20} strokeWidth={ICON} className="mt-0.5 shrink-0 text-ms-moss" />
                  <span>Séances à domicile à Bruxelles et en périphérie, ou en visio.</span>
                </li>
                <li className="flex items-start gap-3 py-4">
                  <Clock size={20} strokeWidth={ICON} className="mt-0.5 shrink-0 text-ms-moss" />
                  <span>Première séance découverte pour construire le parcours de l’élève.</span>
                </li>
                <li className="flex items-start gap-3 py-4">
                  <Phone size={20} strokeWidth={ICON} className="mt-0.5 shrink-0 text-ms-moss" />
                  <a href="tel:+32499289766" className="transition-colors hover:text-ms-moss">+32 499 28 97 66</a>
                </li>
              </ul>
            </Reveal>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
