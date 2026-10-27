import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Images } from "lucide-react";
import StudentShell, { STUDENT_ICON } from "@/components/student/StudentShell";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { VOCAB_THEMES } from "@/data/arabicVocabulary";

const WORD_COUNT = VOCAB_THEMES.reduce((n, t) => n + t.words.length, 0);

/** Une activité : toute la carte est le lien. */
function ActivityCard({ href, tile, tileClass, arabic, title, text }: {
  href: string; tile: ReactNode; tileClass: string; arabic: string; title: string; text: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 min-w-0 items-center gap-4 rounded-3xl border border-ms-line bg-ms-surface p-5 shadow-[var(--ms-shadow-student)] transition-[border-color,transform] duration-[140ms] hover:border-ms-control active:scale-[0.99] sm:gap-5 sm:p-6"
    >
      <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${tileClass}`}>{tile}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-2xl font-extrabold leading-8">{title}</span>
        <span lang="ar" dir="rtl" className="ms-arabic self-start text-xl text-ms-muted">{arabic}</span>
        <span className="text-base text-ms-muted">{text}</span>
      </span>
      <ChevronRight size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true"
        className="shrink-0 text-ms-muted transition-transform duration-[140ms] group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function ArabicHub() {
  return (
    <StudentShell>
      <div className="flex flex-col gap-8">
        <Link href="/student" data-variant="quiet" className="ms-button -ms-3 self-start text-ms-primary">
          <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Mes leçons
        </Link>

        <header className="flex flex-col gap-2">
          <p className="text-base font-bold text-ms-muted">Pédagogie Montessori</p>
          <h1 className="text-[2rem] font-extrabold leading-10 tracking-[-0.02em]">Apprends l&apos;arabe</h1>
          <p lang="ar" dir="rtl" className="ms-arabic self-start text-[1.75rem]">تَعَلَّمِ العَرَبِيَّة</p>
          <p className="max-w-[60ch] text-ms-muted">
            Des mots illustrés et les lettres de l&apos;alphabet, à découvrir à ton rythme.
          </p>
        </header>

        <section aria-labelledby="activites" className="flex flex-col gap-4">
          <h2 id="activites" className="sr-only">Activités</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ActivityCard
              href="/arabic/vocabulary"
              tile={<Images size={36} strokeWidth={1.75} aria-hidden="true" />}
              tileClass="bg-ms-blush-soft text-ms-blush-ink"
              arabic="المُفْرَدَات"
              title="Vocabulaire"
              text={`${VOCAB_THEMES.length} thèmes : animaux, couleurs, famille…`}
            />
            <ActivityCard
              href="/arabic/reading"
              tile={<span lang="ar" dir="rtl" className="ms-arabic text-[2rem] leading-none" aria-hidden="true">أ ب</span>}
              tileClass="bg-ms-slate-soft text-ms-slate-ink"
              arabic="الأَلِفْبَاء"
              title="Alphabet"
              text={`${ARABIC_ALPHABET.length} lettres : formes, sons et exemples`}
            />
          </div>
        </section>

        <dl className="grid grid-cols-3 gap-3 rounded-3xl bg-ms-sage-soft p-4 text-center sm:p-5">
          {[
            { value: ARABIC_ALPHABET.length, label: "lettres" },
            { value: VOCAB_THEMES.length, label: "thèmes" },
            { value: WORD_COUNT, label: "mots illustrés" },
          ].map(({ value, label }) => (
            <div key={label} className="flex min-w-0 flex-col-reverse gap-1">
              <dt className="text-sm font-semibold text-ms-sage-ink sm:text-base">{label}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </StudentShell>
  );
}
