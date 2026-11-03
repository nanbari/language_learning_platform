"use client";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { letterColor, lettersPerLesson, MAX_REVIEW_LETTERS, type LetterLevel } from "@/lib/presentation";
import { LetterGlyph } from "@/components/present/LetterTracing";

export interface LettersChoice {
  level: LetterLevel;
  letterIds: number[];
  reviewIds: number[];
}

/**
 * Réglages d'une leçon de lettres (bloc « Lettres » de l'éditeur) : niveau,
 * lettres du jour, lettres à réviser. La vidéo d'introduction et le
 * diaporama du cours en direct en sont tirés.
 */
export function LettersPicker({ value, onChange }: { value: LettersChoice; onChange: (next: LettersChoice) => void }) {
  const { level, letterIds, reviewIds } = value;
  const perLesson = lettersPerLesson(level);

  // Au-delà du nombre de lettres du niveau, la plus anciennement choisie cède sa place.
  const toggleLetter = (id: number) => onChange({
    ...value,
    letterIds: letterIds.includes(id) ? letterIds.filter((i) => i !== id) : [...letterIds, id].slice(-perLesson),
    reviewIds: reviewIds.filter((i) => i !== id),
  });

  const toggleReview = (id: number) => onChange({
    ...value,
    reviewIds: reviewIds.includes(id) ? reviewIds.filter((i) => i !== id) : [...reviewIds, id].slice(-MAX_REVIEW_LETTERS),
  });

  // En passant au niveau avancé, seule la dernière lettre choisie est conservée.
  const changeLevel = (next: LetterLevel) => onChange({ ...value, level: next, letterIds: letterIds.slice(-lettersPerLesson(next)) });

  const connecting = letterColor(ARABIC_ALPHABET.find((l) => l.medial.endsWith("ـ"))!);
  const oneSided = letterColor(ARABIC_ALPHABET.find((l) => !l.medial.endsWith("ـ"))!);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold leading-5">Niveau</legend>
        <div className="grid max-w-sm grid-cols-2 gap-2" role="radiogroup">
          {([["beginner", "Débutant"], ["advanced", "Avancé"]] as const).map(([option, label]) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={level === option}
              onClick={() => changeLevel(option)}
              className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors duration-[140ms] ${
                level === option ? "border-ms-primary bg-ms-primary-soft text-ms-ink" : "border-ms-control bg-ms-surface hover:bg-ms-surface-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold leading-5">
          {perLesson > 1 ? "Lettres étudiées" : "Lettre étudiée"}
          <span className="font-normal text-ms-muted tabular-nums">
            {letterIds.length} sélectionnée{letterIds.length > 1 ? "s" : ""}
            {perLesson > 1 ? ` · une à ${perLesson}` : ` sur ${perLesson}`}
          </span>
        </legend>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ms-muted">
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm border-2" style={{ borderColor: connecting }} /> se lie à la lettre suivante</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm border-2" style={{ borderColor: oneSided }} /> ne se lie pas à la suivante</span>
        </p>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" dir="rtl" lang="ar">
          {ARABIC_ALPHABET.map((letter) => {
            const selected = letterIds.includes(letter.id);
            return (
              <button
                key={letter.id}
                type="button"
                onClick={() => toggleLetter(letter.id)}
                aria-pressed={selected}
                aria-label={letter.nameTranslit}
                title={letter.nameTranslit}
                className={`relative flex aspect-square min-h-11 items-center justify-center rounded-xl border-2 transition-colors duration-[140ms] ${
                  selected ? "text-ms-on-primary" : "bg-ms-surface text-ms-ink hover:bg-ms-surface-muted"
                }`}
                style={{
                  borderColor: letterColor(letter),
                  background: selected ? letterColor(letter) : undefined,
                }}
              >
                <LetterGlyph char={letter.isolated} className="h-3/4 w-3/4" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold leading-5">
          Lettres à réviser
          <span className="font-normal text-ms-muted tabular-nums">facultatif · {reviewIds.length} sur {MAX_REVIEW_LETTERS} au plus</span>
        </legend>
        <p className="-mt-1 text-sm text-ms-muted">
          Rappelées puis proposées en exercice à la fin de la séance, après les lettres du jour.
        </p>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" dir="rtl" lang="ar">
          {ARABIC_ALPHABET.map((letter) => {
            const inLesson = letterIds.includes(letter.id);
            const selected = reviewIds.includes(letter.id);
            return (
              <button
                key={letter.id}
                type="button"
                onClick={() => toggleReview(letter.id)}
                disabled={inLesson}
                aria-pressed={selected}
                aria-label={inLesson ? `${letter.nameTranslit}, lettre de la leçon` : letter.nameTranslit}
                title={inLesson ? `${letter.nameTranslit} — lettre de la leçon` : letter.nameTranslit}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-xl border-2 transition-colors duration-[140ms] disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-40 ${
                  selected ? "border-ms-slate-ink bg-ms-slate-ink text-ms-on-primary" : "border-ms-line bg-ms-surface text-ms-ink enabled:hover:bg-ms-surface-muted"
                }`}
              >
                <LetterGlyph char={letter.isolated} className="h-3/4 w-3/4" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <details className="group rounded-xl bg-ms-surface-muted px-4 py-3 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Déroulé de la séance</summary>
        <p className="mt-2 max-w-[70ch] leading-6 text-ms-muted">
          {level === "beginner"
            ? "Déroulé : tracé animé de chaque lettre isolée. Les exercices sont regroupés en fin de séance : l'élève écrit chaque lettre au doigt, sur son pointillé ; chaque lettre est à retrouver parmi trois lettres ; puis, la lettre étant montrée, l'élève écoute trois sons et choisit le sien. Les lettres à réviser suivent, avec les mêmes exercices. Aucune forme liée ni mot écrit en arabe, hormis le « أَحْسَنْتُمْ » de l'écran final ; le nom des lettres n'est jamais écrit."
            : "Une lettre par séance. Déroulé : tracé animé, puis les trois formes (début, milieu, fin), chacune avec un mot illustré où la lettre est mise en couleur. Les exercices viennent en fin de séance : trois mots à compléter en choisissant la bonne forme, un par position ; les lettres à réviser, à reconnaître en couleur dans un mot ; enfin l'écriture au doigt de chaque forme liée, sur son pointillé. Le nom des lettres n'est jamais écrit."}
        </p>
      </details>
    </div>
  );
}
