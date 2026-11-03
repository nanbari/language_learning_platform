"use client";
import { useState } from "react";
import { Check, Volume2 } from "lucide-react";
import { LazyConfetti } from "@/components/LazyConfetti";
import type { ArabicLetter } from "@/data/arabicAlphabet";
import { LetterGlyph } from "@/components/present/LetterTracing";
import { STUDENT_ICON } from "@/components/student/StudentShell";
import { accentButton, type Accent } from "@/components/student/accents";

/**
 * « Retrouve la lettre », joué seul (leçon ou révision) : l'élève entend la
 * lettre et touche la bonne parmi trois. La cible n'est jamais écrite ni
 * mise en avant : seule l'écoute permet de répondre.
 *
 * Mêmes règles que le jeu du cours en direct (Slides, LetterChoices) : une
 * lettre déjà essayée ne se rejoue pas, la bonne réponse clôt le jeu, chaque
 * essai part dans `onPick`. Seule la présentation change : consigne en
 * français, bouton d'écoute bien visible, confettis à la réussite.
 */
export function FindLetterStage({ target, choices, accent, onListen, onPick }: {
  target: ArabicLetter;
  choices: ArabicLetter[];
  accent: Accent;
  onListen: () => void;
  onPick: (choiceId: string, correct: boolean) => void;
}) {
  const [tried, setTried] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const [listened, setListened] = useState(false);

  const pick = (letter: ArabicLetter) => {
    if (found || tried.includes(letter.id)) return;
    const correct = letter.id === target.id;
    onPick(String(letter.id), correct);
    if (correct) setFound(true);
    else setTried((t) => [...t, letter.id]);
  };

  const feedback = found
    ? { text: "Tu as trouvé.", tone: "found" as const }
    : tried.length > 0
      ? { text: "Écoute encore. Tu peux réessayer.", tone: "retry" as const }
      : null;

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col items-center gap-6 sm:gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-xl font-bold leading-7 sm:text-2xl sm:leading-8">Écoute, puis touche la lettre.</p>
        <button
          type="button"
          onClick={() => { setListened(true); onListen(); }}
          data-variant="primary"
          className="ms-button min-w-44"
          style={accentButton(accent)}
        >
          <Volume2 size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" />
          {listened ? "Réécouter" : "Écouter"}
        </button>
      </div>

      <div
        role="group"
        aria-label="Lettres à choisir"
        lang="ar"
        dir="rtl"
        className="ms-answer-grid w-full rounded-3xl p-2 min-[400px]:p-3 sm:p-5"
        style={{ background: accent.soft, maxInlineSize: "40rem" }}
      >
        {choices.map((letter) => {
          const isFound = found && letter.id === target.id;
          const isTried = tried.includes(letter.id);
          const state = isFound ? "found" : isTried ? "tried" : "rest";
          return (
            <button
              key={letter.id}
              type="button"
              onClick={() => pick(letter)}
              disabled={found || isTried}
              data-state={state}
              aria-label={`${letter.isolated}${isFound ? " — trouvée" : isTried ? " — déjà essayée" : ""}`}
              className="ms-answer-tile"
            >
              <span className="ms-answer-glyph flex w-full items-center justify-center" aria-hidden="true">
                <LetterGlyph char={letter.isolated} className="aspect-square w-full max-w-36" />
              </span>
              {isFound && (
                <span className="absolute end-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-ms-blush text-ms-ink">
                  <Check size={22} strokeWidth={2.5} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Zone réservée : le message ne fait pas sauter la page. */}
      <div aria-live="polite" className="flex min-h-16 items-center justify-center text-center text-xl font-bold leading-7">
        {feedback?.tone === "found" && (
          <>
            <LazyConfetti />
            <span className="sr-only">{feedback.text}</span>
          </>
        )}
        {feedback?.tone === "retry" && <span className="sr-only">{feedback.text}</span>}
      </div>
    </div>
  );
}
