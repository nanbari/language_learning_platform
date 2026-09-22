// theme.ts — source unique des couleurs, courbes et ressorts des animations.
// Jamais de couleur ni de courbe en dur dans un composant.
import { Easing } from "remotion";

export const theme = {
  colors: {
    // Fond crème du site et teintes de la charte graphique.
    bg: "#F5EEE8",
    bgAlt: "#FFFDF8",
    rose: "#BB908E",
    bleu: "#8BA3B1",
    sauge: "#6B705C",
    gris: "#7B868E",
    olive: "#999B84",
    ink: "#2D2D2D",
    // Couteau, verre, paille : neutres, pour laisser le fruit seul en couleur.
    steel: "#C9CFD4",
    steelDark: "#8F979E",
    glass: "rgba(255, 255, 255, 0.55)",
    glassEdge: "rgba(123, 134, 142, 0.55)",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;

/** Un fruit : ses couleurs de peau, de chair et de jus, et sa silhouette. */
export interface FruitPalette {
  skin: string;
  skinDark: string;
  flesh: string;
  fleshDark: string;
  juice: string;
  leaf: string;
}
