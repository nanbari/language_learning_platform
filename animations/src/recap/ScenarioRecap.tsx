import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { BgMesh, Grade } from "../components/Layers";
import { SceneFrame } from "../components/Motion";
import { AllLetters, LetterCard } from "./LettersRecap";
import { AllWords, ClipFrame, Opening, WordCard } from "./VocabRecap";
import { CLIP_FRAMES, type ScenarioRecapProps, type ScenarioScene } from "./types";

export function scenarioDuration(scenes: ScenarioScene[]): number {
  return Math.max(1, scenes.reduce((n, s) => n + s.frames, 0));
}

const Scene: React.FC<{ scene: ScenarioScene }> = ({ scene }) => {
  switch (scene.kind) {
    case "title": return <SceneFrame><Opening title={scene.title} color={scene.color} /></SceneFrame>;
    case "letter": return <SceneFrame><LetterCard letter={scene.letter} /></SceneFrame>;
    case "letters": return <AllLetters letters={scene.letters} />;
    case "word": return <SceneFrame><WordCard word={scene.word} color={scene.color} /></SceneFrame>;
    case "clip": return <ClipFrame src={scene.src} color={scene.color} loop={scene.frames > CLIP_FRAMES} />;
    case "words": return <AllWords words={scene.words} color={scene.color} />;
    case "pause": return null;
  }
};

/** Vidéo d'introduction écrite par l'enseignant : ses scènes, dans l'ordre de son script. */
export const ScenarioRecap: React.FC<ScenarioRecapProps> = ({ scenes }) => (
  <AbsoluteFill>
    <BgMesh />
    <Series>
      {scenes.map((scene, i) => (
        <Series.Sequence key={i} durationInFrames={Math.max(1, scene.frames)}>
          <Scene scene={scene} />
        </Series.Sequence>
      ))}
    </Series>
    <Grade />
  </AbsoluteFill>
);
