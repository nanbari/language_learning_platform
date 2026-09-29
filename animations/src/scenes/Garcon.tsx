import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Stage } from "../components/Layers";
import { SceneFrame } from "../components/Motion";
import { BoyArms, BoyBody, REST, Table, path, useBoyBreath, type BoyPose } from "../components/Boy";

/**
 * Présentation du garçon, avant les gestes : il apparaît derrière la table,
 * lève la main droite (à l'écran) et salue trois fois, puis repose la main.
 */
const RISE_AT = 0;
const HAND_UP = 22, WAVE_FROM = 34, WAVE_TO = 82, HAND_DOWN = 96;

export const Garcon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breath = useBoyBreath();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  const rise = spring({ frame: frame - RISE_AT, fps, config: theme.spring.bouncy });
  const y = interpolate(rise, [0, 1], [70, 0]) + breath;

  // Salut : la main monte près de la tête, balance de gauche à droite, redescend.
  const up = { x: 812, y: 196 };
  const wave = frame >= WAVE_FROM && frame <= WAVE_TO ? Math.sin(((frame - WAVE_FROM) / (WAVE_TO - WAVE_FROM)) * Math.PI * 6) : 0;
  const waveFade = interpolate(frame, [WAVE_FROM, WAVE_FROM + 6, WAVE_TO - 6, WAVE_TO], [0, 1, 1, 0], clamp);
  const r = path(frame, [[HAND_UP, REST.r], [WAVE_FROM, up], [WAVE_TO, up], [HAND_DOWN, REST.r]]);
  const raised = interpolate(frame, [HAND_UP, WAVE_FROM, WAVE_TO, HAND_DOWN], [0, 1, 1, 0], { easing: theme.ease.inOut, ...clamp });

  const pose: BoyPose = {
    l: { x: REST.l.x, y: REST.l.y + y * 0.4 },
    r: { x: r.x + wave * 18 * waveFade, y: r.y + y * 0.4 },
    rAngle: raised > 0.5 ? -90 + wave * 18 * waveFade : undefined,
    rOpen: raised > 0.5,
    y,
    tilt: wave * 4 * waveFade + raised * 3,
  };

  return (
    <Stage>
      <SceneFrame>
        <div style={{ position: "absolute", inset: 0, opacity: Math.min(1, rise * 1.6) }}><BoyBody pose={pose} /></div>
        <Table />
        <div style={{ position: "absolute", inset: 0, opacity: Math.min(1, rise * 1.6) }}><BoyArms pose={pose} /></div>
      </SceneFrame>
    </Stage>
  );
};
