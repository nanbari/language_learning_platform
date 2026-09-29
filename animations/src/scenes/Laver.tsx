import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, FruitDefs, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { BowlBack, BowlFront, Tap } from "../components/Props";
import { FRUIT_SHADOW, SceneFrame, useEnter } from "../components/Motion";
import { BoyScene, REST, TABLE_TOP, path, useBoyBreath, type BoyPose, type Pt } from "../components/Boy";

/**
 * Laver : un saladier sur la table, la grappe dedans ; un robinet descend du
 * haut de l'écran. Le garçon prend la grappe par la tige et la tient sous le
 * robinet ; l'eau coule, éclabousse les grains, ruisselle dans le saladier ;
 * il balance doucement la grappe, des reflets de propreté apparaissent, puis
 * l'eau s'arrête.
 */
const K = 0.55;
/** Prise de la main : le haut de la tige, dans la boîte du fruit. */
const GRIP = { x: 200, y: 68 };
const BOWL = { x: 870, y: TABLE_TOP + 36 };
const IN_BOWL: Pt = { x: BOWL.x, y: BOWL.y - 16 - (368 - GRIP.y) * K };
const UNDER_TAP: Pt = { x: 870, y: 290 };
// Coin haut-gauche de la boîte du robinet (260 × 220) : le bec, en (TAP_X + 60, TAP_Y + 190), tombe sur le côté gauche de la grappe.
const TAP_X = 780, TAP_Y = 0;
const SPOUT = { x: TAP_X + 60, y: TAP_Y + 190 };
/** Haut du grain que touche le filet d'eau (grain en (140, 150), rayon 33). */
const FRUIT_TOP = UNDER_TAP.y + (150 - 33 - GRIP.y) * K;
const BUNCH_BOTTOM = UNDER_TAP.y + (368 - GRIP.y) * K;
const PICK_AT = 8, TAKEN_AT = 20, LIFTED_AT = 32;
const WATER_ON = 36, WATER_OFF = 96;

/** Un point de rebond sur le fruit, une trajectoire en cloche, en boucle. */
const SPLASHES = Array.from({ length: 12 }, (_, i) => ({
  offset: (i * 7) % 20,
  x0: SPOUT.x - 24 + ((i * 53) % 48),
  vx: ((i % 2 ? 1 : -1) * (30 + ((i * 37) % 70))),
  height: 30 + ((i * 29) % 50),
  r: 3 + (i % 3) * 2,
}));
/** Reflets, autour du centre de la grappe. */
const SPARKLES = [[-60, -30], [30, -60], [64, 6], [-20, 20], [-70, 40], [16, -14], [48, 60], [-36, 70]];

export const Laver: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { Shape } = FRUITS[fruit];
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  const tapIn = useEnter(0, theme.spring.smooth);
  const breath = useBoyBreath();

  // Eau : le filet descend du bec jusqu'au fruit, puis se retire par le haut à la fin.
  const flowDown = interpolate(frame, [WATER_ON, WATER_ON + 8], [0, 1], { easing: theme.ease.in, ...clamp });
  const flowOff = interpolate(frame, [WATER_OFF, WATER_OFF + 8], [0, 1], { easing: theme.ease.in, ...clamp });
  const streamTop = SPOUT.y + flowOff * (FRUIT_TOP - SPOUT.y);
  const streamBottom = SPOUT.y + flowDown * (FRUIT_TOP + 8 - SPOUT.y);
  const flowing = frame >= WATER_ON + 6 && frame < WATER_OFF + 4;
  const rinse = frame >= WATER_ON + 6 && frame < WATER_OFF + 14;
  const water = interpolate(frame, [WATER_ON + 10, WATER_OFF + 10], [0, 1], { easing: theme.ease.out, ...clamp });

  // La grappe : prise dans le saladier, levée sous le robinet, balancée sous le jet.
  const at = path(frame, [[TAKEN_AT, IN_BOWL], [LIFTED_AT, UNDER_TAP]]);
  const hit = Math.sin(Math.min(1, spring({ frame: frame - WATER_ON - 6, fps, config: theme.spring.bouncy })) * Math.PI) * 4;
  const sway = (flowing ? Math.sin(frame / 7) * 5 : Math.sin(frame / 22) * 1.2) + hit;

  // Propreté : les reflets s'installent vers la fin du rinçage.
  const clean = interpolate(frame, [WATER_OFF - 30, WATER_OFF + 6], [0, 1], { easing: theme.ease.out, ...clamp });

  // Le poing serre la tige par la droite : le filet d'eau passe à sa gauche, sur les grains.
  const hand = (p: Pt): Pt => ({ x: p.x + 24, y: p.y + 4 });
  const r = frame < TAKEN_AT ? path(frame, [[PICK_AT, REST.r], [TAKEN_AT, hand(IN_BOWL)]]) : hand(at);
  const pose: BoyPose = {
    l: REST.l, r,
    rAngle: frame >= TAKEN_AT - 4 ? 180 : undefined,
    y: breath,
    tilt: interpolate(frame, [TAKEN_AT, LIFTED_AT], [3, 8], { easing: theme.ease.inOut, ...clamp }),
    nod: interpolate(frame, [TAKEN_AT, LIFTED_AT], [2, 4], { easing: theme.ease.inOut, ...clamp }),
  };
  const bunch = `translate(${at.x} ${at.y}) rotate(${sway}) scale(${K}) translate(${-GRIP.x} ${-GRIP.y})`;

  // Filet d'eau : deux bords ondulés, un cœur clair, des traits de brillance qui descendent.
  const stream = (() => {
    if (frame < WATER_ON || flowOff >= 1 || streamBottom <= streamTop + 4) return null;
    const h = streamBottom - streamTop;
    const n = 12;
    const width = (i: number) => 11 + Math.sin(frame / 2.2 + i * 0.9) * 2 + (i / n) * 2;
    const leftEdge = Array.from({ length: n + 1 }, (_, i) => `${i === 0 ? "M" : "L"}${(-width(i)).toFixed(1)} ${((h * i) / n).toFixed(1)}`).join(" ");
    const rightEdge = Array.from({ length: n + 1 }, (_, k) => { const i = n - k; return `L${width(i).toFixed(1)} ${((h * i) / n).toFixed(1)}`; }).join(" ");
    return (
      <svg width="80" height={h + 20} viewBox={`-40 0 80 ${h + 20}`} style={{ position: "absolute", left: SPOUT.x - 40, top: streamTop, overflow: "visible" }}>
        <path d={`${leftEdge} L11 ${h.toFixed(1)} ${rightEdge} Z`} fill={theme.colors.bleu} opacity="0.75" />
        <path d={`M-2 0 L-2 ${h}`} stroke="#FFFFFF" strokeWidth="3" opacity="0.7" strokeLinecap="round" />
        {[0, 1, 2].map((k) => {
          const y = ((frame * 14 + k * 90) % (h + 40)) - 20;
          return <rect key={k} x="1" y={y} width="3" height="20" rx="1.5" fill="#FFFFFF" opacity="0.55" />;
        })}
      </svg>
    );
  })();

  return (
    <Stage>
      <SceneFrame>
        <BoyScene
          pose={pose}
          front={
            <>
              {stream}
              {/* Éclaboussures : gouttes qui rebondissent sur les grains. */}
              {flowing && SPLASHES.map((sp, i) => {
                const t = (frame - WATER_ON - 6 + sp.offset) % 20;
                const p = t / 20;
                const x = sp.x0 + sp.vx * p;
                const y = FRUIT_TOP + 4 - sp.height * Math.sin(Math.PI * p) + p * p * 50;
                const fade = interpolate(p, [0, 0.1, 0.8, 1], [0, 1, 1, 0], clamp);
                return <div key={i} style={{ position: "absolute", left: x - sp.r, top: y - sp.r, width: sp.r * 2, height: sp.r * 2, borderRadius: "50%", background: i % 3 === 0 ? "#FFFFFF" : theme.colors.bleu, opacity: fade * 0.9 }} />;
              })}
            </>
          }
        >
          <BowlBack x={BOWL.x} y={BOWL.y} water={water} />
          {/* Eau qui ruisselle sous la grappe et tombe dans le saladier. */}
          {rinse && [0, 1, 2, 3].map((i) => {
            const t = (frame * 1.3 + i * 11) % 24;
            const x = UNDER_TAP.x - 44 + i * 28 + Math.sin(i) * 6;
            const y = BUNCH_BOTTOM - 30 + t * 5;
            const fade = interpolate(t, [0, 5, 18, 24], [0, 0.8, 0.8, 0], clamp);
            return <div key={i} style={{ position: "absolute", left: x - 3, top: y, width: 7, height: 14 + (i % 2) * 5, borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%", background: theme.colors.bleu, opacity: fade }} />;
          })}
          <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: FRUIT_SHADOW }}>
            <FruitDefs />
            <g transform={bunch}>
              <Shape />
            </g>
          </svg>
          {/* Reflets de propreté : petites étoiles qui scintillent sur les grains. */}
          <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <g transform={`translate(${at.x} ${at.y}) rotate(${sway}) translate(0 ${(240 - GRIP.y) * K})`}>
              {SPARKLES.map(([dx, dy], i) => {
                const twinkle = 0.5 + 0.5 * Math.sin(frame / 3 + i * 1.7);
                const sz = 0.7 + (i % 3) * 0.25;
                return <path key={i} transform={`translate(${dx} ${dy}) scale(${sz})`} d="M0 -9 Q1.5 -1.5 9 0 Q1.5 1.5 0 9 Q-1.5 1.5 -9 0 Q-1.5 -1.5 0 -9 Z" fill="#FFFFFF" opacity={clean * twinkle} />;
              })}
            </g>
          </svg>
          {/* Le bord avant du saladier passe devant la grappe tant qu'elle y repose. */}
          <BowlFront x={BOWL.x} y={BOWL.y} />
          {/* Robinet, descendu du haut de l'écran. */}
          <svg
            width="260" height="220" viewBox="0 0 260 220"
            style={{
              position: "absolute", left: TAP_X, top: TAP_Y, overflow: "visible",
              opacity: tapIn, transform: `translateY(${interpolate(tapIn, [0, 1], [-160, 0])}px)`,
              filter: "drop-shadow(0 12px 14px rgba(45,45,45,0.18))",
            }}
          >
            <Tap open={flowing ? 1 : 0} reach={300} />
          </svg>
        </BoyScene>
      </SceneFrame>
    </Stage>
  );
};
