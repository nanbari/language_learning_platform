import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { theme } from "../theme";
import { BgMesh, Grade } from "../components/Layers";
import { SceneFrame } from "../components/Motion";
import { END_DELAY, END_STAGGER, LETTER_FRAMES, endFrames, type LettersRecapProps, type RecapLetter } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Le tracé commence après l'entrée de la carte et finit avant la pause. */
const TRACE_FROM = 12, TRACE_TO = 72, MARK_FRAMES = 8;

/**
 * Récapitulatif des lettres du jour : chacune s'écrit comme au cahier, le
 * glyphe naskh révélé le long du geste du stylo, puis toutes reviennent
 * ensemble. Aucun texte : l'enfant revoit les formes.
 */
export const LettersRecap: React.FC<LettersRecapProps> = ({ letters }) => (
  <AbsoluteFill>
    <BgMesh />
    {letters.map((letter, i) => (
      <Sequence key={i} from={i * LETTER_FRAMES} durationInFrames={LETTER_FRAMES}>
        <SceneFrame>
          <LetterCard letter={letter} />
        </SceneFrame>
      </Sequence>
    ))}
    <Sequence from={letters.length * LETTER_FRAMES} durationInFrames={endFrames(letters.length)}>
      <AllLetters letters={letters} />
    </Sequence>
    <Grade />
  </AbsoluteFill>
);

const LetterCard: React.FC<{ letter: RecapLetter }> = ({ letter }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: theme.spring.bouncy });
  const maskId = `trace-${letter.char.charCodeAt(0)}`;

  // Les traits se partagent le temps du tracé au prorata de leur longueur, puis les points.
  const lengths = letter.strokes.map((s) => getLength(s.d));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const markTime = letter.marks.length * MARK_FRAMES;
  const traceEnd = TRACE_TO - markTime;
  const frames = lengths.map((l) => ((traceEnd - TRACE_FROM) * l) / total);
  const strokes = letter.strokes.map((s, i) => {
    const begin = TRACE_FROM + frames.slice(0, i).reduce((a, b) => a + b, 0);
    return { ...s, length: lengths[i], progress: interpolate(frame, [begin, begin + frames[i]], [0, 1], clamp) };
  });
  const active = strokes.find((s) => s.progress > 0 && s.progress < 1);
  const pen = active ? getPointAtLength(active.d, active.length * active.progress) : null;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 560, height: 560, borderRadius: 48, background: theme.colors.bgAlt,
          border: `8px solid ${letter.color}`, boxShadow: "0 24px 60px rgba(45,45,45,0.14)",
          transform: `scale(${interpolate(enter, [0, 1], [0.6, 1])})`, opacity: enter,
        }}
      >
        <svg viewBox="0 0 1000 1000" width="100%" height="100%">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
              {strokes.map((s, i) => (
                <path
                  key={i} d={s.d} fill="none" stroke="#fff" strokeWidth={s.width}
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={s.length} strokeDashoffset={s.length * (1 - s.progress)}
                />
              ))}
              {letter.marks.map((m, i) => {
                const at = traceEnd + i * MARK_FRAMES;
                const r = m.r * spring({ frame: frame - at, fps, config: theme.spring.snappy });
                return <circle key={i} cx={m.cx} cy={m.cy} r={Math.max(0, r)} fill="#fff" />;
              })}
            </mask>
          </defs>
          {/* Modèle en filigrane, puis la lettre révélée par le geste */}
          <path d={letter.outline} fill="#E4DACB" />
          <path d={letter.outline} fill={letter.color} mask={`url(#${maskId})`} />
          {pen && <circle cx={pen.x} cy={pen.y} r={16} fill={theme.colors.ink} />}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

/** Fin : les lettres du jour côte à côte, dans l'ordre de lecture (de droite à gauche). */
const AllLetters: React.FC<{ letters: RecapLetter[] }> = ({ letters }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = Math.min(360, 1100 / letters.length - 40);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 40 }}>
      {letters.map((letter, i) => {
        const p = spring({ frame: frame - END_DELAY - i * END_STAGGER, fps, config: theme.spring.smooth });
        return (
          <div
            key={i}
            style={{
              width: size, height: size, borderRadius: 36, background: theme.colors.bgAlt,
              border: `6px solid ${letter.color}`, boxShadow: "0 18px 44px rgba(45,45,45,0.12)",
              transform: `scale(${p}) translateY(${Math.sin((frame + i * 10) / 24) * 6}px)`,
            }}
          >
            <svg viewBox="100 100 800 800" width="100%" height="100%">
              <path d={letter.outline} fill={letter.color} />
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
