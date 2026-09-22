import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { Knife } from "../components/Props";
import { Drop, FruitSvg, GroundShadow, SceneFrame, useBreathe, useEnter } from "../components/Motion";

/**
 * Couper : le fruit entre, le couteau descend, tranche, s'écarte ; les deux
 * moitiés s'ouvrent et montrent la chair, quelques gouttes de jus tombent.
 */
const FRUIT_SIZE = 460;
const CX = 640, CY = 380;
const CUT_AT = 44;

export const Couper: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { juice } = FRUITS[fruit].palette;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  const enter = useEnter(0);
  const breathe = useBreathe();

  // Couteau : arrive en haut à droite, se place, tranche, repart à droite.
  const knifeIn = spring({ frame: frame - 16, fps, config: theme.spring.smooth });
  const knifeX = interpolate(knifeIn, [0, 1], [CX + 420, CX]);
  const knifeRot = interpolate(knifeIn, [0, 1], [-35, 0]);
  const knifeCut = interpolate(frame, [CUT_AT - 8, CUT_AT + 4], [CY - 460, CY - 150], { easing: theme.ease.inOut, ...clamp });
  const knifeOut = interpolate(frame, [CUT_AT + 10, CUT_AT + 22], [0, 1], { easing: theme.ease.in, ...clamp });
  const knifeY = knifeCut;
  const knifeVisible = frame >= 12 && knifeOut < 1;

  // Moitiés : s'écartent et s'inclinent une fois la lame passée.
  const open = spring({ frame: frame - CUT_AT - 2, fps, config: theme.spring.bouncy });
  const gap = interpolate(open, [0, 1], [0, 70]);
  const tilt = interpolate(open, [0, 1], [0, 7]);
  const cut = frame >= CUT_AT + 2;

  const fruitScale = interpolate(enter, [0, 1], [0.6, 1]) * breathe.scale;
  const base: React.CSSProperties = {
    position: "absolute", left: CX - FRUIT_SIZE / 2, top: CY - FRUIT_SIZE / 2 + breathe.y,
    width: FRUIT_SIZE, height: FRUIT_SIZE, opacity: enter,
  };

  return (
    <Stage>
      <SceneFrame>
        {!cut && <GroundShadow x={CX} y={CY + FRUIT_SIZE * 0.36} width={FRUIT_SIZE * 0.7 * fruitScale} opacity={enter} lift={1 - enter} />}
        {cut && (
          <>
            <GroundShadow x={CX - gap - 90} y={CY + FRUIT_SIZE * 0.36} width={FRUIT_SIZE * 0.42} />
            <GroundShadow x={CX + gap + 90} y={CY + FRUIT_SIZE * 0.36} width={FRUIT_SIZE * 0.42} />
          </>
        )}
        {!cut && (
          <div style={{ ...base, transform: `scale(${fruitScale}) translateY(${interpolate(enter, [0, 1], [40, 0])}px)` }}>
            <FruitSvg id={fruit} size={FRUIT_SIZE} />
          </div>
        )}
        {cut && (
          <>
            <div style={{ ...base, transform: `translateX(${-gap}px) rotate(${-tilt}deg)`, transformOrigin: "50% 100%", clipPath: "inset(0 50% 0 0)" }}>
              <FruitSvg id={fruit} mode="flesh" size={FRUIT_SIZE} />
            </div>
            <div style={{ ...base, transform: `translateX(${gap}px) rotate(${tilt}deg)`, transformOrigin: "50% 100%", clipPath: "inset(0 0 0 50%)" }}>
              <FruitSvg id={fruit} mode="flesh" size={FRUIT_SIZE} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <Drop key={i} x={CX - 30 + i * 20} y0={CY + 40 + (i % 2) * 30} y1={CY + 250} start={CUT_AT + 4 + i * 4} color={juice} r={7 + (i % 2) * 3} />
            ))}
          </>
        )}
        {knifeVisible && (
          <svg
            width="120" height="360" viewBox="0 0 120 360"
            style={{
              position: "absolute", left: knifeX - 60, top: knifeY, overflow: "visible",
              transform: `translateX(${knifeOut * 520}px) rotate(${knifeRot + knifeOut * 30}deg)`,
              transformOrigin: "50% 0%",
              filter: "drop-shadow(0 12px 16px rgba(45,45,45,0.18))",
            }}
          >
            <Knife />
          </svg>
        )}
      </SceneFrame>
    </Stage>
  );
};
