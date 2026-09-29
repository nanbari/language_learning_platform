import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { Glass, Straw } from "../components/Props";
import { Drop, FruitSvg, GroundShadow, SceneFrame, useEnter } from "../components/Motion";
import { BoyScene, REST, TABLE_TOP, path, useBoyBreath, type BoyPose, type Pt } from "../components/Boy";

/**
 * Jus : une moitié de fruit attend sur la table, à côté d'un verre vide. Le
 * garçon la prend à deux mains, la lève au-dessus du verre, face coupée vers
 * le bas, et la presse trois fois ; le jus coule, le verre se remplit. Il la
 * repose, et une paille se plante dans le verre.
 */
const FRUIT_SIZE = 230;
const GLASS_SCALE = 0.72;
const CONTACT = TABLE_TOP + 36;
const GX = 800;
/** Coin haut-gauche de la boîte du verre (200 × 300) : son fond (y = 280) touche la table. */
const GY = CONTACT - 280 * GLASS_SCALE;
/** Centre de la moitié posée sur la table (sa tranche, y = 272, touche la table) et levée au-dessus du verre. */
const ON_TABLE: Pt = { x: 640, y: CONTACT - (272 / 400 - 0.5) * FRUIT_SIZE };
const ABOVE: Pt = { x: GX, y: GY + 30 * GLASS_SCALE - 30 - (272 / 400 - 0.5) * FRUIT_SIZE - 6 };
/** Les mains serrent le dôme de part et d'autre, juste au-dessus de la tranche (demi-largeur 135 / 400). */
const GRIP = { dx: FRUIT_SIZE * (135 / 400) + 16, dy: FRUIT_SIZE * 0.03 };
const PICK_AT = 6, TAKEN_AT = 18, LIFTED_AT = 32;
const SQUEEZES = [38, 54, 70];
const PUT_FROM = 84, PUT_AT = 98, STRAW_AT = 100;

export const Jus: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { juice } = FRUITS[fruit].palette;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const breath = useBoyBreath();

  const glassIn = useEnter(0, theme.spring.smooth);
  const fruitIn = useEnter(2);

  // La moitié : posée, levée au-dessus du verre, puis reposée.
  const at = path(frame, [[TAKEN_AT, ON_TABLE], [LIFTED_AT, ABOVE], [PUT_FROM, ABOVE], [PUT_AT, ON_TABLE]]);

  // Pression des mains : le dôme se resserre puis reprend sa forme ; il rapetisse un peu à chaque fois.
  const squeeze = SQUEEZES.reduce((acc, s) => acc + Math.sin(Math.min(1, spring({ frame: frame - s, fps, config: theme.spring.bouncy })) * Math.PI), 0);
  const pressed = SQUEEZES.filter((s) => frame >= s + 8).length;
  const shrink = 1 - pressed * 0.04;
  const sx = (1 - squeeze * 0.12) * shrink;
  const sy = (1 + squeeze * 0.05) * shrink;
  const grip = GRIP.dx * sx;

  const level = interpolate(frame, [SQUEEZES[0] + 8, SQUEEZES[2] + 20], [0, 0.8], { easing: theme.ease.inOut, ...clamp });
  const strawIn = spring({ frame: frame - STRAW_AT, fps, config: theme.spring.snappy });

  // Mains : vont chercher la moitié, la tiennent, puis la lâchent.
  const holding = (p: Pt, side: number): Pt => ({ x: p.x + side * grip, y: p.y + GRIP.dy });
  const l = frame < TAKEN_AT ? path(frame, [[PICK_AT, REST.l], [TAKEN_AT, holding(ON_TABLE, -1)]]) : frame <= PUT_AT ? holding(at, -1) : path(frame, [[PUT_AT + 2, holding(ON_TABLE, -1)], [PUT_AT + 16, REST.l]]);
  const r = frame < TAKEN_AT ? path(frame, [[PICK_AT, REST.r], [TAKEN_AT, holding(ON_TABLE, 1)]]) : frame <= PUT_AT ? holding(at, 1) : path(frame, [[PUT_AT + 2, holding(ON_TABLE, 1)], [PUT_AT + 16, REST.r]]);
  const gripping = frame >= TAKEN_AT - 4 && frame <= PUT_AT + 4;

  const pose: BoyPose = {
    l, r,
    lAngle: gripping ? 0 : undefined,
    rAngle: gripping ? 180 : undefined,
    // À chaque pression, le buste se tasse un peu.
    y: breath + squeeze * 3,
    tilt: interpolate(frame, [TAKEN_AT, LIFTED_AT, PUT_FROM, PUT_AT], [0, 6, 6, 0], { easing: theme.ease.inOut, ...clamp }),
    nod: interpolate(frame, [TAKEN_AT, LIFTED_AT], [2, 6], { easing: theme.ease.inOut, ...clamp }),
  };

  const lifted = interpolate(frame, [TAKEN_AT, LIFTED_AT, PUT_FROM, PUT_AT], [0, 1, 1, 0], clamp);

  return (
    <Stage>
      <SceneFrame>
        <BoyScene
          pose={pose}
          front={SQUEEZES.flatMap((s, i) =>
            [0, 1, 2].map((k) => (
              <Drop key={`${i}-${k}`} x={GX - 16 + k * 16} y0={ABOVE.y + (272 / 400 - 0.5) * FRUIT_SIZE} y1={GY + (280 - 250 * level) * GLASS_SCALE} start={s + 4 + k * 3} color={juice} r={6 + (k % 2) * 2} />
            )),
          )}
        >
          <GroundShadow x={GX} y={CONTACT} width={170} opacity={glassIn} lift={1 - glassIn} />
          <GroundShadow x={ON_TABLE.x} y={CONTACT} width={FRUIT_SIZE * 0.9} opacity={fruitIn * (1 - lifted)} lift={lifted} />
          <svg
            width="200" height="300" viewBox="0 0 200 300"
            style={{
              position: "absolute", left: GX - 100, top: GY, overflow: "visible",
              opacity: glassIn, transform: `translateY(${interpolate(glassIn, [0, 1], [60, 0])}px) scale(${GLASS_SCALE * interpolate(glassIn, [0, 1], [0.85, 1])})`,
              transformOrigin: "50% 0%",
            }}
          >
            <Glass level={level} juice={juice} />
          </svg>
          {frame >= STRAW_AT && (
            <svg
              width="24" height="300" viewBox="0 0 24 300"
              style={{
                position: "absolute", left: GX - 12, top: GY + 190 - 300, overflow: "visible",
                opacity: strawIn,
                transform: `translateY(${interpolate(strawIn, [0, 1], [-120, 0])}px) rotate(${interpolate(strawIn, [0, 1], [24, 12])}deg) scale(${GLASS_SCALE})`,
                transformOrigin: "50% 100%",
              }}
            >
              <Straw />
            </svg>
          )}
          <div
            style={{
              position: "absolute", left: at.x - FRUIT_SIZE / 2, top: at.y - FRUIT_SIZE / 2,
              width: FRUIT_SIZE, height: FRUIT_SIZE, opacity: fruitIn,
              transform: `scale(${interpolate(fruitIn, [0, 1], [0.6, 1]) * sx}, ${interpolate(fruitIn, [0, 1], [0.6, 1]) * sy})`,
              transformOrigin: "50% 60%",
            }}
          >
            <FruitSvg id={fruit} mode="half" size={FRUIT_SIZE} />
          </div>
        </BoyScene>
      </SceneFrame>
    </Stage>
  );
};
