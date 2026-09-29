import React from "react";
import { Composition } from "remotion";
import type { FruitId } from "./fruits";
import { Couper } from "./scenes/Couper";
import { Manger } from "./scenes/Manger";
import { Jus } from "./scenes/Jus";
import { Eplucher } from "./scenes/Eplucher";
import { Laver } from "./scenes/Laver";
import { Garcon } from "./scenes/Garcon";
import { LettersRecap } from "./recap/LettersRecap";
import { VocabRecap, vocabDuration } from "./recap/VocabRecap";
import { LETTER_FRAMES, endFrames } from "./recap/types";
import { SAMPLE_LETTERS, SAMPLE_VOCAB } from "./recap/samples";
import { LessonRecap, lessonDuration } from "./recap/LessonRecap";

export const FPS = 30;
export const DURATION = 120;
export const WIDTH = 1280;
export const HEIGHT = 720;

/**
 * Un seul geste par fruit. L'identifiant est aussi le nom du fichier MP4 :
 * `pomme-couper` → public/animations/fruits/pomme-couper.mp4.
 */
export const CLIPS: Record<string, { fruit: FruitId; Scene: React.FC<{ fruit: FruitId }> }> = {
  "pomme-couper": { fruit: "pomme", Scene: Couper },
  "orange-jus": { fruit: "orange", Scene: Jus },
  "fraise-manger": { fruit: "fraise", Scene: Manger },
  "banane-eplucher": { fruit: "banane", Scene: Eplucher },
  "raisin-laver": { fruit: "raisin", Scene: Laver },
};

export const Root: React.FC = () => (
  <>
    {Object.entries(CLIPS).map(([id, { fruit, Scene }]) => (
      <Composition
        key={id}
        id={id}
        component={Scene}
        defaultProps={{ fruit }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {/* Présentation du garçon qui fait tous les gestes : public/animations/fruits/garcon.mp4. */}
    <Composition id="garcon" component={Garcon} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    {/* Vidéos récapitulatives des cours en direct : données passées au rendu (src/lib/recapVideo.ts du site). */}
    <Composition
      id="recap-lettres"
      component={LettersRecap}
      defaultProps={SAMPLE_LETTERS}
      calculateMetadata={({ props }) => ({ durationInFrames: props.letters.length * LETTER_FRAMES + endFrames(props.letters.length) })}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* Vidéo d'introduction d'une leçon, d'où est tiré son diaporama de cours en direct (src/lib/liveDeck.ts du site). */}
    <Composition
      id="recap-lecon"
      component={LessonRecap}
      defaultProps={{ parts: [{ kind: "letters" as const, ...SAMPLE_LETTERS }, { kind: "vocab" as const, ...SAMPLE_VOCAB }] }}
      calculateMetadata={({ props }) => ({ durationInFrames: lessonDuration(props.parts) })}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="recap-vocabulaire"
      component={VocabRecap}
      defaultProps={SAMPLE_VOCAB}
      calculateMetadata={({ props }) => ({ durationInFrames: vocabDuration(props.words) })}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
