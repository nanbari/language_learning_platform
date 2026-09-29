import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, FruitDefs, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { FRUIT_SHADOW, GroundShadow, SceneFrame, useEnter } from "../components/Motion";
import { BoyScene, REST, TABLE_TOP, path, useBoyBreath, type BoyPose, type Pt } from "../components/Boy";

/**
 * Manger : le fruit attend sur la table. Le garçon le prend par ses feuilles,
 * le porte à sa bouche (le visage reste sans traits : c'est le fruit qui se
 * fait croquer), et le mange en quatre bouchées, en mâchant ; il ne reste que
 * les feuilles, qu'il repose sur la table.
 */
const FRUIT_SIZE = 140;
const K = FRUIT_SIZE / 400;
const CONTACT = TABLE_TOP + 36;
/** Point de prise, dans la boîte du fruit : sous les feuilles. */
const GRIP = { x: 200, y: 96 };
/** Pointe du fruit, dans sa boîte. */
const TIP = { x: 200, y: 350 };
const MOUTH: Pt = { x: 648, y: 262 };
/** Recul du poing derrière le point de prise, en px. */
const HAND_BACK = 16;
/** Direction de la main vers la bouche, et rotation du fruit pour y pointer. */
const DIR = { x: -0.95, y: -0.3 };
const EAT_ROT = 105;
const AT_MOUTH: Pt = { x: MOUTH.x - DIR.x * (TIP.y - GRIP.y) * K, y: MOUTH.y - DIR.y * (TIP.y - GRIP.y) * K };
const ON_TABLE: Pt = { x: 820, y: CONTACT - (TIP.y - GRIP.y) * K };
// Les feuilles reposent à plat : leur bas (y = 130 dans la boîte) touche la table.
const LEAVES_DOWN: Pt = { x: 840, y: CONTACT - (130 - GRIP.y) * K };
const REACH_AT = 8, TAKEN_AT = 20, RAISED_AT = 34;
const FIRST_BITE = 36, BITE_EVERY = 11;
/**
 * Bouchées, dans la boîte du fruit : des cercles centrés près de la pointe,
 * de plus en plus grands, qui entament le fruit par le bout sans le trouer.
 */
const BITES: [number, number, number][] = [[205, 365, 52], [190, 338, 78], [210, 318, 102], [200, 300, 130]];
/** Ce qui reste à la fin : les feuilles et un peu du haut du fruit. */
const LEFTOVER = { cx: 200, cy: 102, rx: 88, ry: 32 };
const DONE_AT = FIRST_BITE + BITES.length * BITE_EVERY;
const PUT_AT = DONE_AT + 12;

export const Manger: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { Shape, palette } = FRUITS[fruit];
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const breath = useBoyBreath();
  const enter = useEnter(0);

  const bites = BITES.map(([x, y, r], i) => {
    const at = FIRST_BITE + i * BITE_EVERY;
    const p = spring({ frame: frame - at, fps, config: theme.spring.snappy });
    return { x, y, r: r * p, at, p };
  });
  // À chaque bouchée, le fruit s'avance vers la bouche, la tête s'incline, puis mâche.
  const chomp = bites.reduce((acc, b) => acc + Math.sin(Math.min(1, b.p) * Math.PI), 0);
  const chew = frame > FIRST_BITE && frame < DONE_AT + 10 ? Math.sin((frame - FIRST_BITE) / 2.2) * 2 : 0;
  const done = spring({ frame: frame - DONE_AT, fps, config: theme.spring.snappy });

  // Main droite : va au fruit, le porte à la bouche, repose les feuilles, revient.
  const held = path(frame, [[TAKEN_AT, ON_TABLE], [RAISED_AT, AT_MOUTH], [DONE_AT + 4, AT_MOUTH], [PUT_AT, LEAVES_DOWN]]);
  const bite = { x: held.x + DIR.x * chomp * 8, y: held.y + DIR.y * chomp * 8 };
  const rot = interpolate(frame, [TAKEN_AT, RAISED_AT, DONE_AT + 4, PUT_AT], [0, EAT_ROT, EAT_ROT, 0], { easing: theme.ease.inOut, ...clamp });
  // Le poing tient le fruit au-dessus des feuilles, pour ne pas cacher le fruit : recul le long de son axe.
  const back = (p: Pt, deg: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return { x: p.x + Math.sin(a) * HAND_BACK, y: p.y - Math.cos(a) * HAND_BACK };
  };
  const r = frame < TAKEN_AT
    ? path(frame, [[REACH_AT, REST.r], [TAKEN_AT, back(ON_TABLE, 0)]])
    : frame <= PUT_AT ? back(bite, rot) : path(frame, [[PUT_AT + 1, back(LEAVES_DOWN, 0)], [PUT_AT + 12, REST.r]]);

  const pose: BoyPose = {
    l: REST.l, r,
    // Le poing tient les feuilles, doigts vers le fruit.
    rAngle: frame >= TAKEN_AT - 4 && frame <= PUT_AT + 2 ? 90 + rot : undefined,
    y: breath,
    tilt: interpolate(frame, [TAKEN_AT, RAISED_AT, DONE_AT, PUT_AT], [3, 5, 5, 2], { easing: theme.ease.inOut, ...clamp }) + chew * 0.6,
    nod: interpolate(frame, [TAKEN_AT, RAISED_AT], [2, 8], { easing: theme.ease.inOut, ...clamp }) + chomp * 5 + chew,
  };

  const lifted = interpolate(frame, [TAKEN_AT, RAISED_AT, DONE_AT, PUT_AT], [0, 1, 1, 0], clamp);
  const fruitAt = frame <= PUT_AT ? bite : LEAVES_DOWN;

  return (
    <Stage>
      <SceneFrame>
        <BoyScene
          pose={pose}
          front={
            <>
              {/* Miettes : deux par bouchée, qui tombent de la bouche. */}
              {bites.flatMap((b, i) =>
                [0, 1].map((k) => {
                  const t = frame - b.at - k * 3;
                  if (t < 0 || t > 24) return null;
                  const px = MOUTH.x + 10 + (k ? 18 : -14) + interpolate(t, [0, 24], [0, k ? 30 : -24], clamp);
                  const py = MOUTH.y + 20 + interpolate(t, [0, 24], [0, 150], { easing: theme.ease.in, ...clamp });
                  const fade = interpolate(t, [16, 24], [1, 0], clamp);
                  return <div key={`${i}-${k}`} style={{ position: "absolute", left: px, top: py, width: 10, height: 10, borderRadius: 3, background: k ? palette.flesh : palette.skin, opacity: fade, transform: `rotate(${t * 14}deg)` }} />;
                }),
              )}
            </>
          }
        >
          <GroundShadow x={ON_TABLE.x} y={CONTACT} width={FRUIT_SIZE * 0.5} opacity={enter * (1 - lifted)} lift={lifted} />
          <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: Math.min(1, enter * 2), filter: FRUIT_SHADOW }}>
            <FruitDefs />
            {/* La morsure enlève la peau sur tout son rayon, et la chair un peu moins : la chair apparaît en bordure. */}
            <mask id="bitesSkin" maskUnits="userSpaceOnUse" x="-50" y="-50" width="500" height="500">
              <rect x="-50" y="-50" width="500" height="500" fill="white" />
              {bites.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="black" />)}
              {/* Dernière bouchée : il ne reste que les feuilles. */}
              <circle cx="200" cy="300" r={130 + done * 200} fill="black" opacity={done > 0.01 ? 1 : 0} />
              <ellipse {...LEFTOVER} fill="white" />
            </mask>
            <mask id="bitesFlesh" maskUnits="userSpaceOnUse" x="-50" y="-50" width="500" height="500">
              <rect x="-50" y="-50" width="500" height="500" fill="white" />
              {bites.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r * 0.8} fill="black" />)}
              <circle cx="200" cy="300" r={104 + done * 200} fill="black" opacity={done > 0.01 ? 1 : 0} />
              <ellipse {...LEFTOVER} fill="white" />
            </mask>
            <g transform={`translate(${fruitAt.x} ${fruitAt.y + interpolate(enter, [0, 1], [-60, 0])}) rotate(${rot}) scale(${K * interpolate(enter, [0, 1], [0.7, 1])}) translate(${-GRIP.x} ${-GRIP.y})`}>
              <g mask="url(#bitesFlesh)"><Shape mode="flesh" /></g>
              <g mask="url(#bitesSkin)"><Shape mode="skin" /></g>
            </g>
          </svg>
        </BoyScene>
      </SceneFrame>
    </Stage>
  );
};
