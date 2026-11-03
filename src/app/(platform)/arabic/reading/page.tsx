"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ARABIC_ALPHABET, ArabicLetter } from "@/data/arabicAlphabet";
import StudentShell, { STUDENT_ICON } from "@/components/student/StudentShell";

const FORMS: { label: string; key: "isolated" | "initial" | "medial" | "final" }[] = [
  { label: "Isolée", key: "isolated" },
  { label: "Initiale", key: "initial" },
  { label: "Médiane", key: "medial" },
  { label: "Finale", key: "final" },
];

/** Fiche d'une lettre : grande forme, nom, quatre formes et un mot d'exemple. */
function LetterDetail({ letter }: { letter: ArabicLetter }) {
  return (
    <div className="ms-panel flex flex-col gap-6 p-5 shadow-[var(--ms-shadow-student)] sm:p-8 md:flex-row md:items-start">
      <span className="flex min-h-48 w-full shrink-0 items-center justify-center rounded-3xl bg-ms-sage-soft text-ms-ink md:w-56">
        <span lang="ar" dir="rtl" className="ms-arabic text-[clamp(6rem,12vw,8rem)] !leading-[1.4]">{letter.isolated}</span>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 lang="ar" dir="rtl" className="ms-arabic text-[1.75rem]">{letter.name}</h2>
          <span className="text-xl font-bold">{letter.nameTranslit}</span>
          <span className="ms-status">/{letter.translit}/</span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FORMS.map(({ label, key }) => (
            <div key={key} className="flex flex-col-reverse items-center gap-1 rounded-2xl bg-ms-canvas p-3 text-center">
              <dt className="text-sm font-semibold text-ms-muted">{label}</dt>
              <dd lang="ar" dir="rtl" className="ms-arabic text-[2rem]">{letter[key]}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl bg-ms-slate-soft px-5 py-3">
          <span lang="ar" dir="rtl" className="ms-arabic text-[2rem] text-ms-ink">{letter.example}</span>
          <span className="min-w-0">
            <span className="block font-bold text-ms-slate-ink">{letter.exampleMeaning}</span>
            <span className="block text-sm text-ms-muted">{letter.exampleTranslit}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AlphabetPage() {
  const [selected, setSelected] = useState<ArabicLetter | null>(null);

  return (
    <StudentShell>
      <div className="flex flex-col gap-8">
        <Link href="/arabic" data-variant="quiet" className="ms-button -ms-3 self-start text-ms-ink">
          <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Apprends l&apos;arabe
        </Link>

        <header className="flex flex-col gap-2">
          <p lang="ar" dir="rtl" className="ms-arabic self-start text-xl text-ms-muted">الأَلِفْبَاء</p>
          <h1 className="text-[2rem] font-extrabold leading-10 tracking-[-0.02em]">Les {ARABIC_ALPHABET.length} lettres arabes</h1>
          <p className="text-xl font-semibold leading-7 text-ms-muted">Touche une lettre pour la découvrir.</p>
        </header>

        {/* Letter grid */}
        <div role="group" aria-label="Lettres de l'alphabet" className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {ARABIC_ALPHABET.map((letter) => {
            const isSelected = selected?.id === letter.id;
            return (
              <button
                key={letter.id}
                type="button"
                onClick={() => setSelected(isSelected ? null : letter)}
                aria-pressed={isSelected}
                aria-label={letter.nameTranslit}
                className={`flex min-h-28 min-w-0 flex-col items-center justify-center gap-0 rounded-[1.25rem] border-2 px-1 pb-2 pt-1 transition-colors duration-[140ms] ${
                  isSelected ? "border-ms-primary bg-ms-primary-soft" : "border-ms-line bg-ms-surface hover:border-ms-control"
                }`}
              >
                <span lang="ar" dir="rtl" className="ms-arabic text-[3.25rem] !leading-[1.35] text-ms-ink" aria-hidden="true">{letter.isolated}</span>
                <span className="text-xs font-semibold text-ms-muted" aria-hidden="true">{letter.nameTranslit}</span>
              </button>
            );
          })}
        </div>

        {/* Letter detail */}
        <section aria-live="polite" aria-label="Lettre choisie">
          {selected && <LetterDetail letter={selected} />}
        </section>
      </div>
    </StudentShell>
  );
}
