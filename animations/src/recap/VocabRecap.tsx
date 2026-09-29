import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoNaskhArabic";
import { theme } from "../theme";
import { BgMesh, Grade } from "../components/Layers";
import { SceneFrame, useBreathe } from "../components/Motion";
import { CLIP_FRAMES, END_DELAY, END_STAGGER, OPEN_FRAMES, endFrames, WORD_FRAMES, type RecapWord, type VocabRecapProps } from "./types";

const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["arabic"] });

/** Début de chaque mot dans la vidéo : sa carte, puis son animation s'il en a une. */
export function wordStarts(words: RecapWord[]): number[] {
  let clock = OPEN_FRAMES;
  return words.map((w) => {
    const at = clock;
    clock += WORD_FRAMES + (w.clip ? CLIP_FRAMES : 0);
    return at;
  });
}

export function vocabDuration(words: RecapWord[]): number {
  return OPEN_FRAMES + words.reduce((n, w) => n + WORD_FRAMES + (w.clip ? CLIP_FRAMES : 0), 0) + endFrames(words.length);
}

/**
 * Récapitulatif d'une leçon de vocabulaire : le titre arabe s'il existe, puis
 * chaque mot (image et mot écrit), suivi de son animation, puis toutes les
 * images ensemble. Aucun texte français.
 */
export const VocabRecap: React.FC<VocabRecapProps> = ({ title, color, words }) => {
  const starts = wordStarts(words);
  return (
    <AbsoluteFill>
      <BgMesh />
      <Sequence durationInFrames={OPEN_FRAMES}>
        <SceneFrame><Opening title={title} color={color} /></SceneFrame>
      </Sequence>
      {words.map((word, i) => (
        <React.Fragment key={i}>
          <Sequence from={starts[i]} durationInFrames={WORD_FRAMES}>
            <SceneFrame><WordCard word={word} color={color} /></SceneFrame>
          </Sequence>
          {word.clip && (
            <Sequence from={starts[i] + WORD_FRAMES} durationInFrames={CLIP_FRAMES}>
              <ClipFrame src={word.clip} color={color} />
            </Sequence>
          )}
        </React.Fragment>
      ))}
      <Sequence from={vocabDuration(words) - endFrames(words.length)} durationInFrames={endFrames(words.length)}>
        <AllWords words={words} color={color} />
      </Sequence>
      <Grade />
    </AbsoluteFill>
  );
};

const Opening: React.FC<{ title?: string | null; color: string }> = ({ title, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: theme.spring.bouncy });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {title ? (
        <div style={{ fontFamily, fontSize: 110, color, direction: "rtl", transform: `scale(${p})` }}>{title}</div>
      ) : (
        <div style={{ width: 140, height: 140, borderRadius: "50%", background: color, transform: `scale(${p})` }} />
      )}
    </AbsoluteFill>
  );
};

const Picture: React.FC<{ word: RecapWord; size: number }> = ({ word, size }) =>
  word.imageUrl ? (
    <Img src={word.imageUrl} style={{ width: size, height: size, objectFit: "contain" }} />
  ) : (
    <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{word.emoji}</span>
  );

const WordCard: React.FC<{ word: RecapWord; color: string }> = ({ word, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: theme.spring.bouncy });
  const label = spring({ frame: frame - 35, fps, config: theme.spring.snappy });
  const breathe = useBreathe();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 620, height: 580, borderRadius: 48, background: theme.colors.bgAlt,
          border: `8px solid ${color}`, boxShadow: "0 24px 60px rgba(45,45,45,0.14)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
          transform: `scale(${interpolate(enter, [0, 1], [0.6, 1]) * breathe.scale}) translateY(${breathe.y}px)`, opacity: enter,
        }}
      >
        <Picture word={word} size={word.arabic ? 360 : 440} />
        {word.arabic && (
          <div style={{ fontFamily, fontSize: 84, color, direction: "rtl", opacity: label, transform: `translateY(${(1 - label) * 30}px)` }}>
            {word.arabic}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** L'animation du mot, dans un cadre de la couleur de la leçon, comme en séance. */
const ClipFrame: React.FC<{ src: string; color: string }> = ({ src, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: theme.spring.smooth });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 1040, height: 585, borderRadius: 40, overflow: "hidden", border: `8px solid ${color}`,
          boxShadow: "0 24px 60px rgba(45,45,45,0.14)", transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`, opacity: p,
        }}
      >
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%" }} />
      </div>
    </AbsoluteFill>
  );
};

/** Fin : toutes les images de la leçon, en grille, qui apparaissent l'une après l'autre. */
const AllWords: React.FC<{ words: RecapWord[]; color: string }> = ({ words, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const perRow = words.length <= 4 ? words.length : Math.ceil(words.length / 2);
  const size = Math.min(260, 1120 / perRow - 30);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 28, width: perRow * (size + 28), direction: "rtl" }}>
        {words.map((word, i) => {
          const p = spring({ frame: frame - END_DELAY - i * END_STAGGER, fps, config: theme.spring.smooth });
          return (
            <div
              key={i}
              style={{
                width: size, height: size, borderRadius: 28, background: theme.colors.bgAlt, border: `5px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${p})`,
              }}
            >
              <Picture word={word} size={size * 0.78} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
