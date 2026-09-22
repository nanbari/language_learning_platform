import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

/** Fond : crème du site, avec deux halos de la charte qui dérivent lentement. */
export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 40;
  const d2 = Math.cos(frame / 70) * 30;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div
        style={{
          position: "absolute", width: 900, height: 900, borderRadius: "50%",
          top: -380, left: -260 + d1, filter: "blur(60px)",
          background: `radial-gradient(circle, ${theme.colors.rose}55, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute", width: 760, height: 760, borderRadius: "50%",
          bottom: -320, right: -220 - d2, filter: "blur(70px)",
          background: `radial-gradient(circle, ${theme.colors.bleu}44, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Légère unification chaude, au-dessus du contenu. */
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.rose, mixBlendMode: "soft-light", opacity: 0.1 }} />
  </AbsoluteFill>
);

/** Grain procédural, très discret sur fond clair. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.04, mixBlendMode: "multiply",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 60%, rgba(45,45,45,0.14) 100%)" }}
  />
);

/** Les cinq couches de chaque scène : fond, contenu, grade, grain, vignette. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <BgMesh />
    <AbsoluteFill>{children}</AbsoluteFill>
    <Grade />
    <Grain />
    <Vignette />
  </AbsoluteFill>
);
