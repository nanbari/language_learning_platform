import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { Glass, Straw } from "../components/Props";
import { Drop, FruitSvg, GroundShadow, SceneFrame, useBreathe, useEnter } from "../components/Motion";

/**
 * Jus : le verre se pose, une moitié de fruit arrive au-dessus, face coupée
 * vers le bas ; trois pressions l'écrasent, des gouttes tombent, le verre se
 * remplit ; la paille se plante.
 */
const FRUIT_SIZE = 300;
const FX = 640, FY = 190;
const GX = 640, GY = 330; // coin haut-gauche de la boîte du verre (200 × 300)
const SQUEEZES = [40, 58, 76];
const STRAW_AT = 96;

export const Jus: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { juice } = FRUITS[fruit].palette;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  const glassIn = useEnter(0, theme.spring.smooth);
  const fruitIn = useEnter(10);
  const breathe = useBreathe();

  // Pression : le fruit s'aplatit puis rebondit ; chaque pression laisse le fruit un peu plus petit.
  const squeeze = SQUEEZES.reduce((acc, at) => {
    const p = spring({ frame: frame - at, fps, config: theme.spring.bouncy });
    return acc + Math.sin(Math.min(1, p) * Math.PI);
  }, 0);
  const pressed = SQUEEZES.filter((at) => frame >= at + 8).length;
  const shrink = 1 - pressed * 0.06;
  const sx = (1 + squeeze * 0.22) * shrink * breathe.scale;
  const sy = (1 - squeeze * 0.3) * shrink * breathe.scale;

  const level = interpolate(frame, [SQUEEZES[0] + 10, SQUEEZES[2] + 22], [0, 0.82], { easing: theme.ease.inOut, ...clamp });
  // Une fois pressée, la moitié remonte pour laisser la place à la paille.
  const lift = interpolate(frame, [SQUEEZES[2] + 14, STRAW_AT + 4], [0, -110], { easing: theme.ease.inOut, ...clamp });
  const strawIn = spring({ frame: frame - STRAW_AT, fps, config: theme.spring.snappy });

  return (
    <Stage>
      <SceneFrame>
        <GroundShadow x={GX} y={GY + 296} width={220} opacity={glassIn} lift={1 - glassIn} />
        <svg
          width="200" height="300" viewBox="0 0 200 300"
          style={{
            position: "absolute", left: GX - 100, top: GY, overflow: "visible",
            opacity: glassIn, transform: `translateY(${interpolate(glassIn, [0, 1], [80, 0])}px) scale(${interpolate(glassIn, [0, 1], [0.8, 1])})`,
            transformOrigin: "50% 100%",
          }}
        >
          <Glass level={level} juice={juice} />
        </svg>

        <div
          style={{
            position: "absolute", left: FX - FRUIT_SIZE / 2, top: FY - FRUIT_SIZE / 2 + breathe.y,
            width: FRUIT_SIZE, height: FRUIT_SIZE, opacity: fruitIn,
            transform: `translateY(${interpolate(fruitIn, [0, 1], [-60, 0]) + lift}px) scale(${interpolate(fruitIn, [0, 1], [0.6, 1]) * sx}, ${interpolate(fruitIn, [0, 1], [0.6, 1]) * sy})`,
            transformOrigin: "50% 100%",
          }}
        >
          <FruitSvg id={fruit} mode="half" size={FRUIT_SIZE} />
        </div>

        {SQUEEZES.flatMap((at, i) =>
          [0, 1, 2].map((k) => (
            <Drop key={`${i}-${k}`} x={FX - 24 + k * 24} y0={FY + 30} y1={GY + 280 - 250 * level} start={at + 4 + k * 3} color={juice} r={8 + (k % 2) * 3} />
          )),
        )}

        {frame >= STRAW_AT && (
          <svg
            width="24" height="300" viewBox="0 0 24 300"
            style={{
              position: "absolute", left: GX - 25, top: GY - 70, overflow: "visible",
              opacity: strawIn,
              transform: `translateY(${interpolate(strawIn, [0, 1], [-140, 0])}px) rotate(${interpolate(strawIn, [0, 1], [24, 12])}deg)`,
              transformOrigin: "50% 100%",
            }}
          >
            <Straw />
          </svg>
        )}
      </SceneFrame>
    </Stage>
  );
};
