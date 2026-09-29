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

  return (
    <div>
      <p className="font-bold text-[#2d2d2d] mb-3">Niveau</p>
      <div className="flex gap-2">
        {([["beginner", "Débutant"], ["advanced", "Avancé"]] as const).map(([option, label]) => (
          <button
            key={option}
            type="button"
            onClick={() => changeLevel(option)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              level === option ? "bg-[#6B705C] text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-[#BB908E]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="font-bold text-[#2d2d2d] mt-5 mb-3">
        {perLesson > 1 ? "Lettres étudiées" : "Lettre étudiée"}{" "}
        <span className="font-semibold text-gray-400">
          — {letterIds.length}/{perLesson} sélectionnée{perLesson > 1 ? "s" : ""}
        </span>
      </p>
      <div className="grid grid-cols-7 gap-2" dir="rtl">
        {ARABIC_ALPHABET.map((letter) => (
          <button
            key={letter.id}
            type="button"
            onClick={() => toggleLetter(letter.id)}
            aria-pressed={letterIds.includes(letter.id)}
            title={letter.nameTranslit}
            className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
              letterIds.includes(letter.id) ? "text-white shadow-md scale-105" : "bg-white text-[#2d2d2d] hover:scale-105"
            }`}
            style={{
              borderColor: letterColor(letter),
              background: letterIds.includes(letter.id) ? letterColor(letter) : undefined,
            }}
          >
            <LetterGlyph char={letter.isolated} className="w-3/4 h-3/4" />
          </button>
        ))}
      </div>

      <p className="font-bold text-[#2d2d2d] mt-5 mb-1">
        Lettres à réviser{" "}
        <span className="font-semibold text-gray-400">
          — facultatif, {reviewIds.length}/{MAX_REVIEW_LETTERS} au plus
        </span>
      </p>
      <p className="text-xs text-gray-500 mb-3">
        Rappelées puis proposées en exercice à la fin de la séance, après les lettres du jour.
      </p>
      <div className="grid grid-cols-7 gap-2" dir="rtl">
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
              title={inLesson ? `${letter.nameTranslit} — lettre de la leçon` : letter.nameTranslit}
              className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed ${
                selected ? "text-white shadow-md scale-105" : "bg-white text-[#2d2d2d] enabled:hover:scale-105"
              }`}
              style={{ borderColor: "#7B868E", background: selected ? "#7B868E" : undefined }}
            >
              <LetterGlyph char={letter.isolated} className="w-3/4 h-3/4" />
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-4">
        {level === "beginner"
          ? "Déroulé : tracé animé de chaque lettre isolée. Les exercices sont regroupés en fin de séance : l'élève écrit chaque lettre au doigt, sur son pointillé ; chacune des trois lettres est à retrouver parmi les trois lettres de la leçon ; puis, la lettre étant montrée, l'élève écoute trois sons et choisit le sien. Les lettres à réviser suivent, avec les mêmes exercices. Aucune forme liée ni mot écrit en arabe, hormis le « أَحْسَنْتُمْ » de l'écran final ; le nom des lettres n'est jamais écrit."
          : "Une lettre par séance. Déroulé : tracé animé, puis les trois formes (début, milieu, fin), chacune avec un mot illustré où la lettre est mise en couleur. Les exercices viennent en fin de séance : trois mots à compléter en choisissant la bonne forme, un par position ; les lettres à réviser, à reconnaître en couleur dans un mot ; enfin l'écriture au doigt de chaque forme liée, sur son pointillé. Le nom des lettres n'est jamais écrit."}
      </p>
    </div>
  );
}
