"use client";
/**
 * Un jeu du bloc « Lettres » joué en autonomie (leçon ou révision) : la
 * consigne que l'enseignant dirait à voix haute est écrite au-dessus du jeu
 * — et lue avec sa voix si un admin l'a enregistrée —, et chaque réponse est
 * journalisée pour la révision (voir letterExercises).
 */
import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { SlideView } from "@/components/present/Slides";
import { teacherQuestion, type Slide } from "@/lib/presentation";
import { useExerciseTracker } from "@/lib/useExerciseTracker";
import { isQuestionKind, loadSounds, playLetterSound, playQuestionSound, readsQuestionOnArrival, stopSounds, type Sounds } from "@/lib/letterSound";

/** Temps laissé à la réussite (confettis) avant l'exercice suivant. */
export const NEXT_LETTER_EXERCISE_DELAY_MS = 1500;

/**
 * Ce que l'élève entend à l'arrivée sur un exercice : pour « retrouver la
 * lettre », le son de la lettre à trouver (la question écrite la donnerait) ;
 * pour « écrire », le son de la lettre à écrire ; pour les autres, la
 * question enregistrée par un admin, s'il y en a une.
 */
function announce(slide: Slide) {
  if (slide.kind === "findLetter") playLetterSound(slide.target);
  else if (slide.kind === "write") playLetterSound(slide.letter);
  else if (isQuestionKind(slide.kind)) playQuestionSound(slide.kind);
}

/** Annonce à l'arrivée : la question d'une suite d'exercices de même type n'est lue qu'au premier. */
function announceOnArrival(slide: Slide, previous: Slide | undefined) {
  if (isQuestionKind(slide.kind) && !readsQuestionOnArrival(slide.kind, previous?.kind)) return;
  announce(slide);
}

/**
 * `eventId` : id sous lequel journaliser les réponses (letterGameId), ou null
 * pour un écran non suivi (l'écriture, qui ne peut pas être ratée). À monter
 * avec une `key` par exercice.
 */
export function LetterExercise({ slide, previous, color, lessonId, eventId, onSolved }: {
  slide: Slide; previous?: Slide; color: string; lessonId: string; eventId: string | null; onSolved: () => void;
}) {
  const [sounds, setSounds] = useState<Sounds | null>(null);
  const solved = useRef(false);
  // La table n'accepte que les types d'exercice existants : un jeu de lettres
  // est un choix parmi plusieurs, journalisé comme un quiz.
  const track = useExerciseTracker({ lessonId, blockId: eventId ?? "", exerciseType: "quiz" });

  useEffect(() => {
    loadSounds().then(setSounds);
    return stopSounds;
  }, []);

  useEffect(() => {
    announceOnArrival(slide, previous);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // « Retrouver la lettre » et « écrire » : pas de question écrite, seulement le son de la lettre.
  const listenOnly = slide.kind === "findLetter" || slide.kind === "write";
  const question = listenOnly ? null : teacherQuestion(slide);
  // Son à réécouter : celui de la lettre, ou la question enregistrée.
  const canReplay = listenOnly || (isQuestionKind(slide.kind) && !!sounds?.questions[slide.kind]);

  return (
    <>
      {(question || canReplay) && (
        <div className="flex items-center justify-center gap-3 mb-4">
          {question && (
            <p
              className="text-center text-3xl font-bold text-[#2D2D2D]/80"
              style={{ fontFamily: "'Noto Naskh Arabic', 'Cairo', serif", direction: "rtl" }}
            >
              {question}
            </p>
          )}
          {canReplay && (
            <button onClick={() => announce(slide)}
              title={listenOnly ? "Réécouter le son" : "Réécouter la question"}
              className={`${listenOnly ? "w-16 h-16" : "w-11 h-11"} shrink-0 rounded-full flex items-center justify-center text-white shadow hover:scale-105 transition-all`}
              style={{ background: color }}>
              <Volume2 size={listenOnly ? 28 : 20} />
            </button>
          )}
        </div>
      )}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full">
          <SlideView
            slide={slide}
            step={0}
            game={{
              onPick: (choiceId, correct) => {
                if (solved.current) return;
                if (eventId) track.attempt(correct, { choiceId });
                if (correct) { solved.current = true; onSolved(); }
              },
            }}
          />
        </div>
      </div>
    </>
  );
}
