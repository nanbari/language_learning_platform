import React from "react";
import { Series } from "remotion";
import { LettersRecap } from "./LettersRecap";
import { VocabRecap, vocabDuration } from "./VocabRecap";
import { LETTER_FRAMES, endFrames, type LessonRecapPart, type LessonRecapProps } from "./types";

export function partDuration(part: LessonRecapPart): number {
  return part.kind === "letters" ? part.letters.length * LETTER_FRAMES + endFrames(part.letters.length) : vocabDuration(part.words);
}

export function lessonDuration(parts: LessonRecapPart[]): number {
  return Math.max(1, parts.reduce((n, part) => n + partDuration(part), 0));
}

/** Vidéo d'introduction d'une leçon : ses lettres puis son vocabulaire, ou l'inverse, selon l'ordre de la leçon. */
export const LessonRecap: React.FC<LessonRecapProps> = ({ parts }) => (
  <Series>
    {parts.map((part, i) => (
      <Series.Sequence key={i} durationInFrames={partDuration(part)}>
        {part.kind === "letters" ? <LettersRecap letters={part.letters} /> : <VocabRecap title={part.title} color={part.color} words={part.words} />}
      </Series.Sequence>
    ))}
  </Series>
);
