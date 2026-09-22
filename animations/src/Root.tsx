import React from "react";
import { Composition } from "remotion";
import type { FruitId } from "./fruits";
import { Couper } from "./scenes/Couper";
import { Manger } from "./scenes/Manger";
import { Jus } from "./scenes/Jus";
import { Eplucher } from "./scenes/Eplucher";
import { Laver } from "./scenes/Laver";

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
  </>
);
