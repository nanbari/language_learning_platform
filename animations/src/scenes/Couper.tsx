import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { Board, Knife } from "../components/Props";
import { Drop, FRUIT_SHADOW, FruitSvg, SceneFrame, useEnter } from "../components/Motion";
import { BoyScene, REST, path, useBoyBreath, type BoyPose, type Pt } from "../components/Boy";

/**
 * Couper : le fruit tombe sur la planche ; le garçon le tient de la main
 * gauche (à l'écran), lève le couteau de la main droite, tranche d'un coup ;
 * les deux moitiés s'ouvrent, la main gauche suit la sienne, quelques gouttes
 * de jus tombent ; il repose le couteau et regarde son travail.
 */
const FRUIT_SIZE = 230;
const CX = 800, BOARD_Y = 552;
// Le bas du fruit (y = 340 dans sa boîte de 400) touche la planche.
const CY = BOARD_Y - 4 - FRUIT_SIZE * (340 / 400 - 0.5);
const KNIFE_SCALE = 0.45;
/** Pointe du couteau sous la main, lame vers le bas. */
const KNIFE_REACH = (360 - 62) * KNIFE_SCALE;
const HOLD_AT = 10, LIFT_AT = 20, RAISED_AT = 34, CUT_AT = 44, BACK_AT = 58, LAY_AT = 76, RELEASE_AT = 84;

export const Couper: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { juice } = FRUITS[fruit].palette;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const breath = useBoyBreath();

  // Le fruit tombe sur la planche et s'y tasse.
  const drop = useEnter(0);
  const fruitY = interpolate(drop, [0, 1], [-120, 0]);
  const squash = 1 + Math.sin(Math.min(1, drop) * Math.PI) * 0.05;

  // Couteau : prêt à droite, levé au-dessus du fruit, tranche, remonte, puis
  // il le couche sur le bord de la planche et le lâche.
  const ready: Pt = { x: 900, y: 390 };
  const above: Pt = { x: CX, y: CY - FRUIT_SIZE * (0.5 - 62 / 400) - 16 - KNIFE_REACH };
  const down: Pt = { x: CX, y: BOARD_Y - 10 - KNIFE_REACH };
  const laid: Pt = { x: 918, y: BOARD_Y + 14 };
  const cutting = interpolate(frame, [CUT_AT - 8, CUT_AT], [0, 1], { easing: theme.ease.in, ...clamp });
  const held = frame < CUT_AT - 8
    ? path(frame, [[LIFT_AT, ready], [RAISED_AT, above]])
    : frame < CUT_AT
      ? { x: CX, y: interpolate(cutting, [0, 1], [above.y, down.y]) }
      : path(frame, [[CUT_AT, down], [BACK_AT, { x: CX + 60, y: above.y + 40 }], [LAY_AT, laid]]);
  const knifeRot = interpolate(frame, [LIFT_AT, RAISED_AT, CUT_AT, BACK_AT, LAY_AT], [0, 8, 0, -10, 90], { easing: theme.ease.inOut, ...clamp });
  const r = path(frame, [[0, held], [LAY_AT + 4, held], [LAY_AT + 18, { x: 880, y: 584 }]]);
  const knifeAt = frame <= LAY_AT ? held : laid;

  // Moitiés : s'écartent et s'inclinent une fois la lame passée.
  const open = spring({ frame: frame - CUT_AT - 1, fps, config: theme.spring.bouncy });
  const gap = interpolate(open, [0, 1], [0, 40]);
  const tilt = interpolate(open, [0, 1], [0, 8]);
  const cut = frame >= CUT_AT;

  // Main gauche : tient le côté gauche du fruit, suit la moitié gauche, puis la lâche.
  const holdPt: Pt = { x: CX - FRUIT_SIZE * 0.33 - gap, y: CY + 14 };
  const l = path(frame, [[HOLD_AT - 4, REST.l], [HOLD_AT + 10, holdPt], [RELEASE_AT, holdPt], [RELEASE_AT + 14, REST.l]]);

  const pose: BoyPose = {
    l, r: frame <= LAY_AT ? held : r,
    lAngle: frame > HOLD_AT && frame < RELEASE_AT + 6 ? -20 : undefined,
    rAngle: frame <= LAY_AT + 4 ? 180 - knifeRot * 0.6 : undefined,
    y: breath,
    tilt: interpolate(frame, [0, 14, LAY_AT, LAY_AT + 16], [0, 7, 7, 3], { easing: theme.ease.inOut, ...clamp }),
    nod: interpolate(frame, [0, 14], [0, 6], { easing: theme.ease.inOut, ...clamp }),
    lean: interpolate(frame, [LIFT_AT, CUT_AT, BACK_AT, LAY_AT, LAY_AT + 18], [0, 2, 0, 4, 0], { easing: theme.ease.inOut, ...clamp }),
  };

  const base: React.CSSProperties = {
    position: "absolute", left: CX - FRUIT_SIZE / 2, top: CY - FRUIT_SIZE / 2,
    width: FRUIT_SIZE, height: FRUIT_SIZE, opacity: Math.min(1, drop * 2),
  };
  const fruitStyle = { transform: `translateY(${fruitY}px) scale(${squash}, ${2 - squash})`, transformOrigin: "50% 85%" };

  return (
    <Stage>
      <SceneFrame>
        <BoyScene
          pose={pose}
          held={
            <>
          {/* Couteau tenu par la poignée : devant l'avant-bras, sous les doigts. */}
              <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: "drop-shadow(0 8px 10px rgba(45,45,45,0.18))" }}>
                <g transform={`translate(${knifeAt.x} ${knifeAt.y}) rotate(${knifeRot}) scale(${KNIFE_SCALE}) translate(-60 -62)`}>
                  <Knife />
                </g>
              </svg>
            </>
          }
          front={cut && [0, 1, 2, 3].map((i) => (
            <Drop key={i} x={CX - 18 + i * 12} y0={CY + 20 + (i % 2) * 20} y1={BOARD_Y - 12} start={CUT_AT + 2 + i * 4} color={juice} r={5 + (i % 2) * 2} />
          ))}
        >
          <Board x={CX} y={BOARD_Y} />
          {!cut && (
            <div style={{ ...base, ...fruitStyle }}>
              <FruitSvg id={fruit} size={FRUIT_SIZE} />
            </div>
          )}
          {cut && (
            <>
              {/* L'ombre est portée par un parent, pour ne pas être coupée net avec la moitié. */}
              {[-1, 1].map((side) => (
                <div key={side} style={{ position: "absolute", inset: 0, filter: FRUIT_SHADOW }}>
                  <div style={{ ...base, transform: `translateX(${side * gap}px) rotate(${side * tilt}deg)`, transformOrigin: "50% 85%", clipPath: side < 0 ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)" }}>
                    <FruitSvg id={fruit} mode="flesh" size={FRUIT_SIZE} style={{ filter: "none" }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </BoyScene>
      </SceneFrame>
    </Stage>
  );
};
