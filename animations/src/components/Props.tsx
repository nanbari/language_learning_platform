import React from "react";
import { theme } from "../theme";

/** Couteau de cuisine, pointe vers le bas, dessiné dans une boîte 120 × 360 (poignée en haut). */
export const Knife: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="gBlade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#F4F6F8" />
        <stop offset="0.45" stopColor="#C9CFD4" />
        <stop offset="0.55" stopColor="#AEB6BD" />
        <stop offset="1" stopColor="#7F878E" />
      </linearGradient>
      <linearGradient id="gHandle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7C8268" />
        <stop offset="0.5" stopColor="#5A5F4B" />
        <stop offset="1" stopColor="#3E4233" />
      </linearGradient>
    </defs>
    <rect x="38" y="0" width="44" height="124" rx="16" fill="url(#gHandle)" />
    <rect x="48" y="12" width="10" height="96" rx="5" fill="#FFFFFF" opacity="0.14" />
    <circle cx="60" cy="30" r="4" fill={theme.colors.steel} opacity="0.8" />
    <circle cx="60" cy="90" r="4" fill={theme.colors.steel} opacity="0.8" />
    <rect x="34" y="118" width="52" height="14" rx="4" fill={theme.colors.steelDark} />
    <path d="M36 128 L84 128 L84 300 C84 330 66 356 60 360 C54 356 36 330 36 300 Z" fill="url(#gBlade)" />
    {/* Fil de la lame et reflet. */}
    <path d="M36 128 L36 300 C36 330 54 356 60 360" stroke="#FFFFFF" strokeWidth="3" fill="none" opacity="0.7" />
    <path d="M46 140 L46 290" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.35" strokeLinecap="round" />
  </g>
);

/** Verre à jus, boîte 200 × 300, rempli à `level` (0 → 1) de la couleur `juice`. */
export const Glass: React.FC<{ level: number; juice: string }> = ({ level, juice }) => {
  const top = 30, bottom = 280, left = 30, right = 170;
  const outline = `M${left} ${top} L${right} ${top} L${right - 14} ${bottom} L${left + 14} ${bottom} Z`;
  const fillTop = bottom - (bottom - top) * Math.max(0, Math.min(1, level));
  return (
    <g>
      <defs>
        <clipPath id="glassClip"><path d={outline} /></clipPath>
        <linearGradient id="gJuice" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={juice} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={juice} />
          <stop offset="1" stopColor={juice} stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="gGlassBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0.2" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Fond du verre : un peu d'épaisseur. */}
      <path d={outline} fill={theme.colors.glass} />
      <g clipPath="url(#glassClip)">
        <rect x={left} y={fillTop} width={right - left} height={bottom - fillTop + 4} fill="url(#gJuice)" />
        {/* Surface du jus : ellipse claire, un peu de mousse. */}
        <ellipse cx={(left + right) / 2} cy={fillTop} rx={(right - left) / 2} ry="6" fill="#FFFFFF" opacity="0.4" />
        {level > 0.05 && [0, 1, 2].map((i) => (
          <circle key={i} cx={left + 30 + i * 40} cy={fillTop + 12 + (i % 2) * 18} r={3 + i} fill="#FFFFFF" opacity="0.3" />
        ))}
        <ellipse cx={(left + right) / 2} cy={bottom} rx={(right - left) / 2 - 14} ry="8" fill={theme.colors.steelDark} opacity="0.25" />
      </g>
      <path d={outline} fill="url(#gGlassBody)" stroke={theme.colors.glassEdge} strokeWidth="5" strokeLinejoin="round" />
      <rect x={left + 16} y={top + 18} width="10" height={bottom - top - 70} rx="5" fill="#FFFFFF" opacity="0.5" />
      <rect x={right - 30} y={top + 40} width="5" height={bottom - top - 110} rx="3" fill="#FFFFFF" opacity="0.3" />
      <ellipse cx={(left + right) / 2} cy={top} rx={(right - left) / 2} ry="7" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity="0.6" />
    </g>
  );
};

/**
 * Robinet chromé, boîte 260 × 220 : tuyau venant du bord droit (prolongé de
 * `reach` au-delà), col de cygne, bec en (60, 190), poignée qui tourne quand
 * `open` passe à 1.
 */
export const Tap: React.FC<{ open: number; reach?: number }> = ({ open, reach = 0 }) => (
  <g>
    <defs>
      <linearGradient id="gChrome" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F4F6F8" />
        <stop offset="0.4" stopColor="#C9CFD4" />
        <stop offset="0.6" stopColor="#8F979E" />
        <stop offset="1" stopColor="#D8DDE1" />
      </linearGradient>
      <linearGradient id="gChromeV" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#F4F6F8" />
        <stop offset="0.4" stopColor="#C9CFD4" />
        <stop offset="0.6" stopColor="#8F979E" />
        <stop offset="1" stopColor="#D8DDE1" />
      </linearGradient>
    </defs>
    {/* Tuyau horizontal depuis la droite, puis col de cygne vers le bec. */}
    <path d={`M${260 + reach} 70 L150 70 C95 70 60 100 60 150 L60 176`} stroke="url(#gChrome)" strokeWidth="34" fill="none" strokeLinecap="butt" />
    <path d={`M${260 + reach} 70 L150 70 C95 70 60 100 60 150 L60 176`} stroke="#FFFFFF" strokeWidth="8" fill="none" opacity="0.5" transform="translate(0 -8)" />
    {/* Bec évasé. */}
    <path d="M36 172 L84 172 L80 194 L40 194 Z" fill="url(#gChromeV)" />
    <ellipse cx="60" cy="194" rx="20" ry="5" fill="#5E666D" />
    {/* Bague et poignée : un levier qui bascule quand l'eau coule. */}
    <rect x="164" y="40" width="30" height="60" rx="8" fill="url(#gChromeV)" />
    <g transform={`rotate(${-20 + open * 55} 179 40)`}>
      <rect x="172" y="0" width="14" height="46" rx="7" fill="url(#gChromeV)" />
      <circle cx="179" cy="4" r="10" fill={theme.colors.rose} />
      <circle cx="176" cy="1" r="3" fill="#FFFFFF" opacity="0.6" />
    </g>
  </g>
);

/** Paille rayée, boîte 24 × 300, inclinée par le parent. */
export const Straw: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="gStraw" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.6" stopColor={theme.colors.bgAlt} />
        <stop offset="1" stopColor="#D8D2C6" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="24" height="300" rx="12" fill="url(#gStraw)" stroke={theme.colors.gris} strokeWidth="2" />
    {Array.from({ length: 7 }).map((_, i) => (
      <path key={i} d={`M2 ${20 + i * 40} L22 ${8 + i * 40} L22 ${24 + i * 40} L2 ${36 + i * 40} Z`} fill={theme.colors.rose} opacity="0.8" />
    ))}
    <rect x="4" y="4" width="4" height="292" rx="2" fill="#FFFFFF" opacity="0.6" />
  </g>
);

/** Planche à découper vue de face, centrée en `x`, dessus à la hauteur `y` ; largeur `w`. */
export const Board: React.FC<{ x: number; y: number; w?: number }> = ({ x, y, w = 300 }) => {
  const c = theme.colors;
  const l = x - w / 2, r = x + w / 2;
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id="gBoardTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3C39C" />
          <stop offset="1" stopColor="#F1DABB" />
        </linearGradient>
      </defs>
      <ellipse cx={x} cy={y + 22} rx={w * 0.55} ry="9" fill="rgba(45,45,45,0.18)" filter="url(#boardSoft)" />
      {/* Poignée à droite, avec son trou. */}
      <rect x={r - 10} y={y - 10} width="62" height="24" rx="12" fill={c.woodDark} />
      <rect x={r - 10} y={y - 14} width="62" height="22" rx="11" fill="#E3C39C" />
      <ellipse cx={r + 32} cy={y - 3} rx="9" ry="4" fill={c.woodDark} />
      {/* Chant, puis dessus. */}
      <rect x={l} y={y - 4} width={w} height="22" rx="8" fill={c.woodDark} />
      <rect x={l} y={y - 16} width={w} height="26" rx="9" fill="url(#gBoardTop)" />
      <path d={`M${l + 16} ${y - 6} L${r - 16} ${y - 6}`} stroke={c.woodDark} strokeWidth="1.5" opacity="0.25" />
      <path d={`M${l + 30} ${y + 1} L${r - 40} ${y + 1}`} stroke={c.woodDark} strokeWidth="1.5" opacity="0.2" />
      <filter id="boardSoft" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="5" /></filter>
    </svg>
  );
};

/**
 * Saladier vu de face, posé en (x, y) (le fond touche la table), largeur `w`.
 * `Back` se dessine derrière ce qu'il contient, `Front` devant ; `water`
 * (0 → 1) remplit un fond d'eau.
 */
export const BOWL_H = 70;
const bowlPaths = (x: number, y: number, w: number) => {
  const l = x - w / 2, r = x + w / 2, top = y - BOWL_H;
  return {
    rim: { cx: x, cy: top, rx: w / 2, ry: 14 },
    body: `M${l} ${top} C${l + 4} ${top + 50} ${x - w * 0.3} ${y} ${x} ${y} C${x + w * 0.3} ${y} ${r - 4} ${top + 50} ${r} ${top} Z`,
  };
};
export const BowlBack: React.FC<{ x: number; y: number; w?: number; water?: number }> = ({ x, y, w = 230, water = 0 }) => {
  const { rim } = bowlPaths(x, y, w);
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <ellipse cx={x} cy={y + 4} rx={w * 0.42} ry="8" fill="rgba(45,45,45,0.2)" filter="url(#bowlSoft)" />
      {/* Intérieur : le fond de la vasque, vu par-dessus le bord arrière. */}
      <ellipse {...rim} fill={theme.colors.steelDark} />
      <ellipse cx={rim.cx} cy={rim.cy + 3} rx={rim.rx - 8} ry={rim.ry - 4} fill="#AEB6BD" />
      {water > 0 && <ellipse cx={rim.cx} cy={rim.cy + 6} rx={(rim.rx - 14) * water} ry={(rim.ry - 7) * water} fill={theme.colors.bleu} opacity="0.7" />}
      <filter id="bowlSoft" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="5" /></filter>
    </svg>
  );
};
export const BowlFront: React.FC<{ x: number; y: number; w?: number }> = ({ x, y, w = 230 }) => {
  const { rim, body } = bowlPaths(x, y, w);
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id="gBowl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={theme.colors.steelDark} />
          <stop offset="0.3" stopColor="#F4F6F8" />
          <stop offset="0.6" stopColor={theme.colors.steel} />
          <stop offset="1" stopColor={theme.colors.steelDark} />
        </linearGradient>
      </defs>
      <path d={body} fill="url(#gBowl)" />
      {/* Bord avant, épais et brillant. */}
      <path d={`M${rim.cx - rim.rx} ${rim.cy} A${rim.rx} ${rim.ry} 0 0 0 ${rim.cx + rim.rx} ${rim.cy}`} stroke="#F4F6F8" strokeWidth="6" fill="none" />
      <path d={`M${x - w * 0.3} ${rim.cy + 24} Q${x - w * 0.26} ${rim.cy + 48} ${x - w * 0.12} ${rim.cy + 58}`} stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
};
