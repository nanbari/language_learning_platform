import React from "react";
import type { FruitPalette } from "../theme";

/**
 * Chaque fruit est dessiné dans une boîte de 400 × 400, centré en (200, 200).
 * `mode` : "skin" dessine le fruit entier ; "flesh" dessine sa silhouette en
 * couleur de chair (la face coupée), avec pépins ou quartiers ; "half" dessine
 * une moitié posée face coupée vers le bas (pour presser), quand le fruit s'y
 * prête, sinon le fruit entier.
 *
 * Les dégradés et motifs sont déclarés une fois dans <FruitDefs /> ; les
 * identifiants sont partagés par tous les <svg> d'une scène.
 */
export type FruitMode = "skin" | "flesh" | "half";
export type FruitId = "pomme" | "orange" | "fraise" | "banane" | "raisin";

export interface FruitProps { mode?: FruitMode }

/** Reflet doux en haut à gauche d'un fruit rond, flouté. */
const Highlight: React.FC<{ cx: number; cy: number; rx: number; ry: number; rotate?: number; opacity?: number }> = ({ cx, cy, rx, ry, rotate = -25, opacity = 0.45 }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" opacity={opacity} transform={`rotate(${rotate} ${cx} ${cy})`} filter="url(#soft)" />
);

export const FRUITS: Record<FruitId, { palette: FruitPalette; Shape: React.FC<FruitProps> }> = {
  pomme: {
    palette: { skin: "#D9433B", skinDark: "#A72B2A", flesh: "#FBF3D9", fleshDark: "#E8D9A9", juice: "#E9C46A", leaf: "#6B9E4C" },
    Shape: ({ mode = "skin" }) => {
      const body = "M200 120 C150 60 60 90 60 190 C60 280 130 350 200 340 C270 350 340 280 340 190 C340 90 250 60 200 120 Z";
      return mode === "flesh" ? (
        <g>
          <path d={body} fill="url(#gPommeSkin)" />
          <path d="M200 135 C158 85 78 108 78 192 C78 272 138 332 200 324 C262 332 322 272 322 192 C322 108 242 85 200 135 Z" fill="url(#gPommeFlesh)" />
          {/* Fibres légères de la chair. */}
          {[-1, 1].map((s) => (
            <path key={s} d={`M200 150 C${200 + s * 40} 200 ${200 + s * 45} 260 200 310`} stroke="#E8D9A9" strokeWidth="3" fill="none" opacity="0.5" />
          ))}
          <path d="M200 160 C170 190 170 240 200 270 C230 240 230 190 200 160 Z" fill="#E8D9A9" opacity="0.9" />
          <ellipse cx="190" cy="205" rx="6" ry="12" fill="#5C3A21" transform="rotate(-18 190 205)" />
          <ellipse cx="211" cy="224" rx="6" ry="12" fill="#5C3A21" transform="rotate(18 211 224)" />
          <path d="M200 125 C202 105 205 90 210 70" stroke="#6B4A2B" strokeWidth="8" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g>
          <path d={body} fill="url(#gPommeSkin)" />
          {/* Creux au sommet et ombre en bas. */}
          <path d="M160 118 C175 100 225 100 240 118 C225 130 175 130 160 118 Z" fill="#8E1F20" opacity="0.35" filter="url(#soft)" />
          <path d="M100 300 C140 345 260 345 300 300 C260 325 140 325 100 300 Z" fill="#6E1516" opacity="0.25" filter="url(#soft)" />
          {/* Stries fines de la peau. */}
          {[120, 150, 250, 280].map((x, i) => (
            <path key={i} d={`M${x} 150 C${x + (i < 2 ? -6 : 6)} 220 ${x + (i < 2 ? -4 : 4)} 280 ${x + (i < 2 ? 8 : -8)} 320`} stroke="#FFD1B0" strokeWidth="2" fill="none" opacity="0.18" />
          ))}
          <Highlight cx={138} cy={172} rx={26} ry={46} rotate={-18} />
          <path d="M200 125 C202 100 205 80 212 62" stroke="url(#gStem)" strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M212 88 C240 60 285 70 290 95 C260 110 225 105 212 88 Z" fill="url(#gLeaf)" />
          <path d="M214 90 C240 84 265 86 288 94" stroke="#3E7A2E" strokeWidth="2" fill="none" opacity="0.6" />
        </g>
      );
    },
  },
  orange: {
    palette: { skin: "#F28C28", skinDark: "#D26E12", flesh: "#FFB25C", fleshDark: "#F28C28", juice: "#F6A21D", leaf: "#5E9A46" },
    Shape: ({ mode = "skin" }) => {
      if (mode === "half") {
        // Moitié posée face coupée vers le bas : dôme de peau, tranche vue de dessous.
        return (
          <g>
            <path d="M65 230 A135 135 0 0 1 335 230 Z" fill="url(#gOrangeSkin)" />
            <path d="M65 230 A135 135 0 0 1 335 230 Z" fill="url(#orangeDimples)" opacity="0.5" />
            <Highlight cx={140} cy={150} rx={30} ry={46} />
            <ellipse cx="200" cy="230" rx="135" ry="42" fill="#FFE9CC" />
            {/* La tranche vue de dessous : un disque de quartiers aplati en ellipse. */}
            <g transform="translate(200 230) scale(1 0.28)">
              <circle cx="0" cy="0" r="122" fill="url(#gOrangeFlesh)" />
              {Array.from({ length: 10 }).map((_, i) => (
                <path key={i} d="M0 0 L0 -112 A112 112 0 0 1 66 -90 Z" fill="#FFC272" stroke="#FFE9CC" strokeWidth="6" strokeLinejoin="round" transform={`rotate(${i * 36})`} />
              ))}
              <circle cx="0" cy="0" r="10" fill="#FFE9CC" />
            </g>
            <ellipse cx="200" cy="230" rx="122" ry="34" fill="url(#gOrangeGloss)" />
          </g>
        );
      }
      return mode === "flesh" ? (
        <g>
          <circle cx="200" cy="210" r="135" fill="url(#gOrangeSkin)" />
          <circle cx="200" cy="210" r="120" fill="#FFE9CC" />
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d="M200 210 L200 100 A110 110 0 0 1 270 133 Z" fill="url(#gOrangeFlesh)" stroke="#FFE9CC" strokeWidth="3" transform={`rotate(${i * 40} 200 210)`} />
          ))}
          <circle cx="200" cy="210" r="8" fill="#FFE9CC" />
        </g>
      ) : (
        <g>
          <circle cx="200" cy="210" r="135" fill="url(#gOrangeSkin)" />
          <circle cx="200" cy="210" r="135" fill="url(#orangeDimples)" opacity="0.5" />
          <Highlight cx={148} cy={148} rx={30} ry={48} />
          <circle cx="200" cy="84" r="9" fill="#B9C68E" />
          <circle cx="200" cy="84" r="4" fill="#7C8A50" />
          <path d="M205 80 C230 55 268 62 272 84 C245 96 215 92 205 80 Z" fill="url(#gLeaf)" />
          <path d="M207 82 C230 74 252 76 270 84" stroke="#3E7A2E" strokeWidth="2" fill="none" opacity="0.6" />
        </g>
      );
    },
  },
  fraise: {
    palette: { skin: "#E0322F", skinDark: "#B21F23", flesh: "#FFD6D6", fleshDark: "#F28C8C", juice: "#E8443F", leaf: "#4F9A3A" },
    Shape: ({ mode = "skin" }) => {
      const body = "M200 350 C110 320 60 240 70 160 C80 110 140 100 200 120 C260 100 320 110 330 160 C340 240 290 320 200 350 Z";
      const seeds: [number, number][] = [[125, 185], [165, 160], [235, 160], [275, 185], [145, 235], [200, 215], [255, 235], [165, 285], [235, 285], [200, 255], [200, 318], [120, 230], [280, 230]];
      const leaves = "M200 118 L150 78 L185 98 L180 58 L200 92 L220 58 L215 98 L250 78 Z";
      return mode === "flesh" ? (
        <g>
          <path d={body} fill="url(#gFraiseSkin)" />
          <path d="M200 332 C126 306 84 236 92 168 C100 130 150 122 200 138 C250 122 300 130 308 168 C316 236 274 306 200 332 Z" fill="url(#gFraiseFlesh)" />
          <path d="M200 300 C150 280 120 230 128 180 C170 190 230 190 272 180 C280 230 250 280 200 300 Z" fill="#FFF6F6" />
          {[-40, -20, 0, 20, 40].map((dx) => (
            <path key={dx} d={`M${200 + dx * 0.4} 150 C${200 + dx} 200 ${200 + dx} 260 ${200 + dx * 0.3} 300`} stroke="#F7B8B8" strokeWidth="2" fill="none" opacity="0.7" />
          ))}
          <path d={leaves} fill="url(#gLeaf)" />
        </g>
      ) : (
        <g>
          <path d={body} fill="url(#gFraiseSkin)" />
          <path d="M120 300 C160 340 240 340 280 300 C240 320 160 320 120 300 Z" fill="#7A1214" opacity="0.3" filter="url(#soft)" />
          {seeds.map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y + 1} rx="7" ry="10" fill="#9E1B1E" opacity="0.55" />
              <ellipse cx={x} cy={y} rx="5" ry="8" fill="#F9E27D" />
              <ellipse cx={x - 1.5} cy={y - 2.5} rx="1.6" ry="3" fill="#FFFFFF" opacity="0.6" />
            </g>
          ))}
          <Highlight cx={135} cy={175} rx={20} ry={40} rotate={-20} opacity={0.35} />
          <path d={leaves} fill="url(#gLeaf)" />
          <path d="M120 130 C150 110 250 110 280 130 C250 122 150 122 120 130 Z" fill="url(#gLeaf)" />
          <path d="M200 118 C200 100 200 90 202 70" stroke="#3E7A2E" strokeWidth="2" fill="none" opacity="0.6" />
        </g>
      );
    },
  },
  banane: {
    palette: { skin: "#F4C542", skinDark: "#D9A21B", flesh: "#FBF0C6", fleshDark: "#EBD892", juice: "#F3E39A", leaf: "#8A6A2B" },
    Shape: ({ mode = "skin" }) => {
      const body = "M70 150 C110 280 250 340 340 250 C350 240 345 225 330 228 C260 290 150 240 100 130 C92 118 66 128 70 150 Z";
      return mode === "flesh" ? (
        <g>
          <path d={body} fill="url(#gBananeSkin)" />
          <path d="M90 152 C126 262 250 316 322 244 C258 282 160 236 112 142 Z" fill="url(#gBananeFlesh)" />
          <path d="M120 165 C160 235 240 280 300 245" stroke="#EBD892" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d={body} fill="url(#gBananeSkin)" />
          <path d="M100 130 C150 240 260 290 330 228 C300 262 200 250 128 160 Z" fill="#C8951A" opacity="0.3" />
          <path d="M84 150 C120 250 240 310 320 240" stroke="#FFF1B8" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.4" />
          {[[150, 210], [190, 245], [240, 270], [280, 268]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="3.5" ry="2.5" fill="#7A5A1E" opacity="0.5" />
          ))}
          <path d="M66 130 C60 118 76 108 86 118 L100 132 L78 148 Z" fill="url(#gStem)" />
          <path d="M340 250 C352 244 356 232 348 226 L330 228 Z" fill="#6E4F1C" />
        </g>
      );
    },
  },
  raisin: {
    palette: { skin: "#5B3F8F", skinDark: "#3E2A66", flesh: "#D8CCEA", fleshDark: "#B9A6D6", juice: "#7B4FA8", leaf: "#5E9A46" },
    Shape: ({ mode = "skin" }) => {
      // Grappe : rangs de plus en plus courts vers le bas ; les grains du fond sont plus sombres.
      const grapes: [number, number][] = [
        [140, 150], [200, 140], [260, 150],
        [110, 200], [170, 195], [230, 195], [290, 200],
        [140, 245], [200, 240], [260, 245],
        [170, 290], [230, 290],
        [200, 335],
      ];
      return (
        <g>
          <path d="M200 60 C202 90 198 110 200 140" stroke="#6E4F1C" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M204 70 C240 40 300 55 305 90 C265 108 220 100 204 70 Z" fill="url(#gLeaf)" />
          <path d="M206 72 C240 66 272 74 300 88" stroke="#3E7A2E" strokeWidth="2" fill="none" opacity="0.6" />
          {/* Rameaux vers les grains du haut. */}
          {[[140, 150], [260, 150]].map(([x, y], i) => (
            <path key={i} d={`M200 135 Q${(200 + x) / 2} ${y - 20} ${x} ${y - 10}`} stroke="#6E4F1C" strokeWidth="4" fill="none" strokeLinecap="round" />
          ))}
          {grapes.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x + 2} cy={y + 4} r="34" fill="#2B1C4A" opacity="0.35" />
              <circle cx={x} cy={y} r="33" fill="url(#gRaisinSkin)" />
              {mode === "skin" ? (
                <ellipse cx={x - 11} cy={y - 12} rx="7" ry="10" fill="#FFFFFF" opacity="0.45" transform={`rotate(-30 ${x - 11} ${y - 12})`} />
              ) : (
                <>
                  <circle cx={x} cy={y} r="24" fill="#D8CCEA" />
                  <circle cx={x} cy={y + 2} r="5" fill="#8A6A2B" opacity="0.6" />
                </>
              )}
            </g>
          ))}
        </g>
      );
    },
  },
};

/** Dégradés, motifs et filtres partagés, à placer une fois dans le <svg>. */
export const FruitDefs: React.FC = () => (
  <defs>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" />
    </filter>

    <radialGradient id="gPommeSkin" cx="0.36" cy="0.32" r="0.8">
      <stop offset="0" stopColor="#F5766A" />
      <stop offset="0.4" stopColor="#DB4740" />
      <stop offset="1" stopColor="#8C1D1F" />
    </radialGradient>
    <radialGradient id="gPommeFlesh" cx="0.5" cy="0.45" r="0.65">
      <stop offset="0" stopColor="#FFFAEA" />
      <stop offset="1" stopColor="#EFE0B6" />
    </radialGradient>

    <radialGradient id="gOrangeSkin" cx="0.36" cy="0.32" r="0.8">
      <stop offset="0" stopColor="#FFB761" />
      <stop offset="0.45" stopColor="#F28C28" />
      <stop offset="1" stopColor="#B4560C" />
    </radialGradient>
    <radialGradient id="gOrangeFlesh" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" stopColor="#FFD79A" />
      <stop offset="1" stopColor="#FFA43E" />
    </radialGradient>
    <linearGradient id="gOrangeGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.25" />
      <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
    </linearGradient>
    <pattern id="orangeDimples" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="2.2" fill="#C86414" opacity="0.5" />
      <circle cx="5" cy="5" r="1" fill="#FFD9A8" opacity="0.5" />
    </pattern>

    <radialGradient id="gFraiseSkin" cx="0.38" cy="0.3" r="0.85">
      <stop offset="0" stopColor="#F5675C" />
      <stop offset="0.45" stopColor="#E0322F" />
      <stop offset="1" stopColor="#8E1418" />
    </radialGradient>
    <radialGradient id="gFraiseFlesh" cx="0.5" cy="0.45" r="0.65">
      <stop offset="0" stopColor="#FFEDED" />
      <stop offset="1" stopColor="#F49A9A" />
    </radialGradient>

    <linearGradient id="gBananeSkin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#FFE27C" />
      <stop offset="0.5" stopColor="#F4C542" />
      <stop offset="1" stopColor="#C48F14" />
    </linearGradient>
    <linearGradient id="gBananeFlesh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#FFF8DC" />
      <stop offset="1" stopColor="#EBD892" />
    </linearGradient>

    <radialGradient id="gRaisinSkin" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#9A7BC8" />
      <stop offset="0.45" stopColor="#5B3F8F" />
      <stop offset="1" stopColor="#2E1D55" />
    </radialGradient>

    <linearGradient id="gLeaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#8CC163" />
      <stop offset="1" stopColor="#3F7F2C" />
    </linearGradient>
    <linearGradient id="gStem" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#8A6A2B" />
      <stop offset="1" stopColor="#4F3416" />
    </linearGradient>
  </defs>
);
