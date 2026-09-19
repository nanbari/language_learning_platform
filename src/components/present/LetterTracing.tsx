"use client";
import { useId } from "react";
import { LETTER_STROKES, type LetterStrokes } from "@/data/letterStrokes";

const SPEED = 420; // unités de tracé par seconde
const START = 0.4;
const PAUSE = 0.25; // respiration entre deux traits
const MARK = 0.3; // apparition d'un point

/** Horaires d'animation : les traits s'enchaînent, puis les points. */
function schedule(glyph: LetterStrokes) {
  let clock = START;
  const strokes = glyph.strokes.map((stroke) => {
    const begin = clock;
    const dur = Math.max(0.5, stroke.length / SPEED);
    clock += dur + PAUSE;
    return { ...stroke, begin: `${begin.toFixed(2)}s`, dur: `${dur.toFixed(2)}s` };
  });
  const marks = glyph.marks.map((mark) => {
    const begin = clock;
    clock += MARK + 0.15;
    return { ...mark, begin: `${begin.toFixed(2)}s` };
  });
  return { strokes, marks };
}

/**
 * Écrit la lettre comme au cahier : le glyphe naskh se révèle le long du
 * geste du stylo (masque épais animé trait par trait, puis les points), un
 * rond noir figurant la pointe. Animations SMIL : remonter le composant
 * (prop `key`) rejoue le tracé depuis le début.
 */
export function LetterTracing({ char, color, className }: { char: string; color: string; className?: string }) {
  const maskId = `trace-${useId().replace(/:/g, "")}`;
  const glyph = LETTER_STROKES[char];
  if (!glyph) return null;

  const { strokes, marks } = schedule(glyph);

  return (
    <svg viewBox="0 0 1000 1000" className={className} role="img" aria-label={char}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
          {strokes.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke="#fff"
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="1"
            >
              <animate attributeName="stroke-dashoffset" from="1" to="0" begin={s.begin} dur={s.dur} fill="freeze" />
            </path>
          ))}
          {marks.map((m, i) => (
            <circle key={i} cx={m.cx} cy={m.cy} r="0" fill="#fff">
              <animate attributeName="r" from="0" to={m.r} begin={m.begin} dur={`${MARK}s`} fill="freeze" />
            </circle>
          ))}
        </mask>
      </defs>

      {/* Modèle en filigrane, puis la lettre révélée par le geste */}
      <path d={glyph.outline} fill="#E4DACB" />
      <path d={glyph.outline} fill={color} mask={`url(#${maskId})`} />

      {strokes.map((s, i) => (
        <circle key={i} r="16" fill="#2D2D2D" opacity="0">
          <set attributeName="opacity" to="1" begin={s.begin} dur={s.dur} />
          <animateMotion path={s.d} begin={s.begin} dur={s.dur} fill="freeze" />
        </circle>
      ))}
    </svg>
  );
}
