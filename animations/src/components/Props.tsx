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
 * Robinet chromé, boîte 260 × 220 : tuyau venant du bord droit, col de cygne,
 * bec en (60, 190), poignée qui tourne quand `open` passe à 1.
 */
export const Tap: React.FC<{ open: number }> = ({ open }) => (
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
    <path d="M260 70 L150 70 C95 70 60 100 60 150 L60 176" stroke="url(#gChrome)" strokeWidth="34" fill="none" strokeLinecap="butt" />
    <path d="M260 70 L150 70 C95 70 60 100 60 150 L60 176" stroke="#FFFFFF" strokeWidth="8" fill="none" opacity="0.5" transform="translate(0 -8)" />
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
