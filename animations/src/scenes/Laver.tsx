import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { Tap } from "../components/Props";
import { FruitSvg, GroundShadow, SceneFrame, useBreathe, useEnter } from "../components/Motion";

/**
 * Laver : un robinet descend du haut de l'écran, le fruit vient se placer
 * dessous ; l'eau coule, éclabousse en gouttes qui rebondissent, ruisselle
 * sous le fruit ; des reflets de propreté apparaissent, puis l'eau s'arrête.
 */
const FRUIT_SIZE = 400;
const CX = 640, CY = 430;
// Coin haut-gauche de la boîte du robinet (260 × 220) : le bec, en (TAP_X + 60, TAP_Y + 190), surplombe les grains.
const TAP_X = CX - 90, TAP_Y = 28;
const SPOUT = { x: TAP_X + 60, y: TAP_Y + 190 };
const WATER_ON = 22, WATER_OFF = 100;
// Haut des grains : à 35 % de la boîte du fruit (la tige et la feuille sont au-dessus).
const FRUIT_TOP = CY - FRUIT_SIZE / 2 + FRUIT_SIZE * 0.35;

/** Un point de rebond sur le fruit, une trajectoire en cloche, en boucle. */
const SPLASHES = Array.from({ length: 14 }, (_, i) => ({
  offset: (i * 7) % 20,
  x0: SPOUT.x - 40 + ((i * 53) % 80),
  vx: ((i % 2 ? 1 : -1) * (40 + ((i * 37) % 90))),
  height: 40 + ((i * 29) % 70),
  r: 4 + (i % 3) * 2,
}));
const SPARKLES = [[-110, -60], [60, -120], [120, 10], [-40, 40], [-140, 60], [30, -30], [90, 110], [-70, 130]];

export const Laver: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  const tapIn = useEnter(0, theme.spring.smooth);
  const fruitIn = useEnter(8);
  const breathe = useBreathe(0.01);

  // Eau : le filet descend du bec jusqu'au fruit, puis se retire par le haut à la fin.
  const flowDown = interpolate(frame, [WATER_ON, WATER_ON + 8], [0, 1], { easing: theme.ease.in, ...clamp });
  const flowOff = interpolate(frame, [WATER_OFF, WATER_OFF + 8], [0, 1], { easing: theme.ease.in, ...clamp });
  const streamTop = SPOUT.y + flowOff * (FRUIT_TOP - SPOUT.y);
  const streamBottom = SPOUT.y + flowDown * (FRUIT_TOP + 10 - SPOUT.y);
  const flowing = frame >= WATER_ON + 6 && frame < WATER_OFF + 4;
  const rinse = frame >= WATER_ON + 6 && frame < WATER_OFF + 14;

  // Le fruit tressaille sous le jet, puis se balance doucement.
  const hit = Math.sin(Math.min(1, spring({ frame: frame - WATER_ON - 6, fps, config: theme.spring.bouncy })) * Math.PI) * 0.05;
  const sway = flowing ? Math.sin(frame / 4) * 1.6 : Math.sin(frame / 22) * 0.8;
  const fruitScale = interpolate(fruitIn, [0, 1], [0.6, 1]) * breathe.scale * (1 - hit);

  // Propreté : les reflets s'installent vers la fin du rinçage.
  const clean = interpolate(frame, [WATER_OFF - 30, WATER_OFF + 6], [0, 1], { easing: theme.ease.out, ...clamp });

  return (
    <Stage>
      <SceneFrame>
        <GroundShadow x={CX} y={CY + FRUIT_SIZE * 0.42} width={FRUIT_SIZE * 0.6 * fruitScale} opacity={fruitIn} lift={1 - fruitIn} />

        {/* Eau qui ruisselle sous le fruit et tombe. */}
        {rinse && [0, 1, 2, 3, 4].map((i) => {
          const t = (frame * 1.3 + i * 11) % 30;
          const x = CX - 70 + i * 36 + Math.sin(i) * 8;
          const y = CY + FRUIT_SIZE * 0.34 + t * 9;
          const fade = interpolate(t, [0, 6, 24, 30], [0, 0.8, 0.8, 0], clamp);
          return <div key={i} style={{ position: "absolute", left: x - 4, top: y, width: 8, height: 16 + (i % 2) * 6, borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%", background: theme.colors.bleu, opacity: fade }} />;
        })}

        <div
          style={{
            position: "absolute", left: CX - FRUIT_SIZE / 2, top: CY - FRUIT_SIZE / 2 + breathe.y,
            width: FRUIT_SIZE, height: FRUIT_SIZE, opacity: fruitIn,
            transform: `translateX(${interpolate(fruitIn, [0, 1], [-320, 0])}px) scale(${fruitScale}) rotate(${sway}deg)`,
            transformOrigin: "50% 20%",
          }}
        >
          <FruitSvg id={fruit} size={FRUIT_SIZE} />
          {/* Reflets de propreté : petites étoiles qui scintillent. */}
          {SPARKLES.map(([dx, dy], i) => {
            const twinkle = 0.5 + 0.5 * Math.sin(frame / 3 + i * 1.7);
            const s = 10 + (i % 3) * 4;
            return (
              <svg key={i} width={s * 2} height={s * 2} viewBox="-10 -10 20 20" style={{ position: "absolute", left: FRUIT_SIZE / 2 + dx - s, top: FRUIT_SIZE / 2 + dy - s, opacity: clean * twinkle }}>
                <path d="M0 -9 Q1.5 -1.5 9 0 Q1.5 1.5 0 9 Q-1.5 1.5 -9 0 Q-1.5 -1.5 0 -9 Z" fill="#FFFFFF" />
              </svg>
            );
          })}
        </div>

        {/* Filet d'eau : deux bords ondulés, un cœur clair, des traits de brillance qui descendent. */}
        {frame >= WATER_ON && flowOff < 1 && streamBottom > streamTop + 4 && (() => {
          const h = streamBottom - streamTop;
          const n = 12;
          const width = (i: number) => 15 + Math.sin(frame / 2.2 + i * 0.9) * 2.5 + (i / n) * 3;
          const leftEdge = Array.from({ length: n + 1 }, (_, i) => `${i === 0 ? "M" : "L"}${(-width(i)).toFixed(1)} ${((h * i) / n).toFixed(1)}`).join(" ");
          const rightEdge = Array.from({ length: n + 1 }, (_, k) => { const i = n - k; return `L${width(i).toFixed(1)} ${((h * i) / n).toFixed(1)}`; }).join(" ");
          return (
            <svg width="80" height={h + 20} viewBox={`-40 0 80 ${h + 20}`} style={{ position: "absolute", left: SPOUT.x - 40, top: streamTop, overflow: "visible" }}>
              <path d={`${leftEdge} L14 ${h.toFixed(1)} ${rightEdge} Z`} fill={theme.colors.bleu} opacity="0.75" />
              <path d={`M-3 0 L-3 ${h}`} stroke="#FFFFFF" strokeWidth="4" opacity="0.7" strokeLinecap="round" />
              {[0, 1, 2].map((k) => {
                const y = ((frame * 14 + k * 90) % (h + 40)) - 20;
                return <rect key={k} x="2" y={y} width="4" height="26" rx="2" fill="#FFFFFF" opacity="0.55" />;
              })}
            </svg>
          );
        })()}

        {/* Éclaboussures : gouttes qui rebondissent sur le fruit. */}
        {flowing && SPLASHES.map((s, i) => {
          const t = (frame - WATER_ON - 6 + s.offset) % 20;
          const p = t / 20;
          const x = s.x0 + s.vx * p;
          const y = FRUIT_TOP + 6 - s.height * Math.sin(Math.PI * p) + p * p * 60;
          const fade = interpolate(p, [0, 0.1, 0.8, 1], [0, 1, 1, 0], clamp);
          return <div key={i} style={{ position: "absolute", left: x - s.r, top: y - s.r, width: s.r * 2, height: s.r * 2, borderRadius: "50%", background: i % 3 === 0 ? "#FFFFFF" : theme.colors.bleu, opacity: fade * 0.9 }} />;
        })}

        {/* Robinet, descendu du haut de l'écran. */}
        <svg
          width="260" height="220" viewBox="0 0 260 220"
          style={{
            position: "absolute", left: TAP_X, top: TAP_Y, overflow: "visible",
            opacity: tapIn, transform: `translateY(${interpolate(tapIn, [0, 1], [-160, 0])}px)`,
            filter: "drop-shadow(0 12px 14px rgba(45,45,45,0.18))",
          }}
        >
          <Tap open={flowing ? 1 : 0} />
        </svg>
      </SceneFrame>
    </Stage>
  );
};
