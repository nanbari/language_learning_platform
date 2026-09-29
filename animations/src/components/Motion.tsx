import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, FruitDefs, type FruitId, type FruitMode } from "../fruits";

/** Progression d'entrée (ressort) à partir de `delay`. */
export function useEnter(delay: number, config: { damping: number; stiffness: number; mass: number } = theme.spring.bouncy): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

/** Sortie de scène : les 12 dernières images, plus rapide que l'entrée. */
export function useExit(): { opacity: number; y: number } {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return {
    opacity: interpolate(frame, [durationInFrames - 12, durationInFrames - 2], [1, 0], clamp),
    y: interpolate(frame, [durationInFrames - 12, durationInFrames - 2], [0, -42], { easing: theme.ease.in, ...clamp }),
  };
}

/** Respiration d'un élément qui reste à l'écran. */
export function useBreathe(amplitude = 0.015): { scale: number; y: number } {
  const frame = useCurrentFrame();
  return { scale: 1 + Math.sin(frame / 22) * amplitude, y: Math.sin(frame / 30) * 3 };
}

/** Un fruit, dans sa boîte 400 × 400, prêt à être transformé par le parent. */
export const FruitSvg: React.FC<{ id: FruitId; mode?: FruitMode; size?: number; style?: React.CSSProperties }> = ({ id, mode = "skin", size = 400, style }) => {
  const { Shape } = FRUITS[id];
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={{ overflow: "visible", filter: FRUIT_SHADOW, ...style }}>
      <FruitDefs />
      <Shape mode={mode} />
    </svg>
  );
};

/** Ombre portée commune aux fruits : douce, décalée vers le bas. */
export const FRUIT_SHADOW = "drop-shadow(0 16px 18px rgba(45,45,45,0.22))";

/**
 * Ombre au sol : une ellipse floue sous l'objet, centrée en (x, y), de largeur
 * `width`. `lift` (0 → 1) l'écarte et l'éclaircit quand l'objet s'élève.
 */
export const GroundShadow: React.FC<{ x: number; y: number; width: number; opacity?: number; lift?: number }> = ({ x, y, width, opacity = 1, lift = 0 }) => {
  const w = width * (1 + lift * 0.3);
  const h = w * 0.16;
  return (
    <div
      style={{
        position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(45,45,45,0.28) 0%, rgba(45,45,45,0.12) 45%, transparent 72%)",
        opacity: opacity * (1 - lift * 0.6), filter: "blur(4px)",
      }}
    />
  );
};

/** Le cadre de la scène : centre et déplacement, avec sortie commune. */
export const SceneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const exit = useExit();
  return (
    <div style={{ position: "absolute", inset: 0, opacity: exit.opacity, transform: `translateY(${exit.y}px)` }}>
      {children}
    </div>
  );
};

/** Goutte de jus qui tombe de (x, y0) à y1 à partir de `start`, en `duration` images. */
export const Drop: React.FC<{ x: number; y0: number; y1: number; start: number; duration?: number; color: string; r?: number }> = ({ x, y0, y1, start, duration = 14, color, r = 9 }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0 || t > duration + 4) return null;
  const y = interpolate(t, [0, duration], [y0, y1], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const splash = interpolate(t, [duration, duration + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stretch = interpolate(t, [0, duration], [1, 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2,
        borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%", background: color, opacity: splash,
        transform: `scaleY(${stretch})`,
      }}
    />
  );
};

/** Éclat de réussite : rayons qui jaillissent en étoile, en une seule couleur. */
export const Burst: React.FC<{ x: number; y: number; start: number; color: string; size?: number }> = ({ x, y, start, color, size = 120 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rays = 10;
  const fade = interpolate(frame - start, [14, 30], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < start) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, opacity: fade }}>
      {Array.from({ length: rays }).map((_, i) => {
        const p = spring({ frame: frame - start - i * 1.2, fps, config: theme.spring.snappy });
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: 0, top: 0, width: size * 0.08, height: size * 0.42 * p,
              background: color, borderRadius: size, transformOrigin: "50% 0%",
              transform: `translateX(-50%) rotate(${(360 / rays) * i}deg) translateY(${size * 0.16}px)`,
            }}
          />
        );
      })}
    </div>
  );
};
