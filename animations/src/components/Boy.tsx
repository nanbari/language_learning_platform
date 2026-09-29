import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

/**
 * Le garçon qui fait tous les gestes : de face, derrière la table, le visage
 * sans yeux, sans nez ni bouche. Il est dessiné en deux calques, dans le repère
 * de l'image (1280 × 720) : <BoyBody /> (tête et buste, derrière la table) et
 * <BoyArms /> (bras et mains, devant la table et devant ce qu'il tient).
 *
 * Les mains sont désignées par leur côté à l'écran : `l` à gauche, `r` à
 * droite. Chaque scène donne la position voulue de chaque main ; le coude se
 * place tout seul (deux segments, coude vers l'extérieur).
 */
export type Pt = { x: number; y: number };

export interface BoyPose {
  /** Main gauche et main droite (à l'écran), centre de la paume. */
  l: Pt;
  r: Pt;
  /** Orientation des mains, en degrés (0 : doigts vers la droite) ; par défaut, le prolongement de l'avant-bras. */
  lAngle?: number;
  rAngle?: number;
  /** Main ouverte (pour saluer) plutôt que fermée. */
  lOpen?: boolean;
  rOpen?: boolean;
  /** Décalage vertical du corps (respiration, entrée), en px. */
  y?: number;
  /** Inclinaison de la tête, en degrés (positive : vers la droite de l'écran). */
  tilt?: number;
  /** Inclinaison du buste, en degrés, autour des hanches. */
  lean?: number;
  /** Tête qui s'avance vers ce qu'il regarde, en px (vers le bas). */
  nod?: number;
}

export const BOY_X = 640;
const HIP = { x: BOY_X, y: 640 };
const HEAD = { x: BOY_X, y: 204 };
const NECK_Y = 292;
const SHOULDER_Y = 372;
const SHOULDER_DX = 98;
const UPPER = 120, FORE = 118;

/** Mains au repos, posées sur la table de part et d'autre du garçon. */
export const REST: { l: Pt; r: Pt } = { l: { x: 530, y: 556 }, r: { x: 750, y: 556 } };

const rot = (p: Pt, c: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180, dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
};

/** Épaules, après le décalage et l'inclinaison du buste. */
function shoulders(pose: BoyPose): { l: Pt; r: Pt } {
  const y = pose.y ?? 0, lean = pose.lean ?? 0;
  return {
    l: rot({ x: BOY_X - SHOULDER_DX, y: SHOULDER_Y + y }, HIP, lean),
    r: rot({ x: BOY_X + SHOULDER_DX, y: SHOULDER_Y + y }, HIP, lean),
  };
}

/** Coude d'un bras de l'épaule `s` à la main `h`, tourné vers l'extérieur (`side` −1 à gauche, 1 à droite) et plutôt vers le bas. */
function elbowOf(s: Pt, h: Pt, side: number): { e: Pt; h: Pt } {
  const dx = h.x - s.x, dy = h.y - s.y;
  const raw = Math.hypot(dx, dy) || 1;
  const d = Math.min(Math.max(raw, Math.abs(UPPER - FORE) + 1), UPPER + FORE - 0.5);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d))));
  const candidates = [base + a, base - a].map((t) => ({ x: s.x + UPPER * Math.cos(t), y: s.y + UPPER * Math.sin(t) }));
  const score = (e: Pt) => side * (e.x - s.x) + 0.6 * (e.y - s.y);
  const e = score(candidates[0]) >= score(candidates[1]) ? candidates[0] : candidates[1];
  // Main hors d'atteinte : le bras s'étire au plus loin dans sa direction.
  const reach = { x: s.x + (dx / raw) * d, y: s.y + (dy / raw) * d };
  return { e, h: reach };
}

/** Respiration du garçon : le buste monte et descend à peine. */
export function useBoyBreath(): number {
  const frame = useCurrentFrame();
  return Math.sin(frame / 24) * 2.5;
}

/** Tête et buste, à dessiner derrière la table. */
export const BoyBody: React.FC<{ pose: BoyPose }> = ({ pose }) => {
  const y = pose.y ?? 0, lean = pose.lean ?? 0, tilt = pose.tilt ?? 0, nod = pose.nod ?? 0;
  const cx = BOY_X, c = theme.colors;
  const torso = [
    `M${cx - 46} ${NECK_Y + 28}`,
    `C${cx - 84} ${NECK_Y + 32} ${cx - 116} ${NECK_Y + 40} ${cx - 124} ${SHOULDER_Y}`,
    `C${cx - 132} ${SHOULDER_Y + 60} ${cx - 122} ${SHOULDER_Y + 170} ${cx - 116} 700`,
    `L${cx + 116} 700`,
    `C${cx + 122} ${SHOULDER_Y + 170} ${cx + 132} ${SHOULDER_Y + 60} ${cx + 124} ${SHOULDER_Y}`,
    `C${cx + 116} ${NECK_Y + 40} ${cx + 84} ${NECK_Y + 32} ${cx + 46} ${NECK_Y + 28}`,
    "Z",
  ].join(" ");
  const hx = HEAD.x, hy = HEAD.y + nod;
  // Cheveux : une calotte arrondie, avec une frange en mèches sur le front.
  const hair = [
    `M${hx - 82} ${hy + 6}`,
    `C${hx - 96} ${hy - 84} ${hx - 42} ${hy - 114} ${hx + 6} ${hy - 110}`,
    `C${hx + 62} ${hy - 108} ${hx + 100} ${hy - 74} ${hx + 82} ${hy + 6}`,
    `C${hx + 78} ${hy - 22} ${hx + 72} ${hy - 38} ${hx + 60} ${hy - 50}`,
    // Frange balayée de droite à gauche, qui ondule légèrement sur le front.
    `C${hx + 38} ${hy - 42} ${hx + 18} ${hy - 40} ${hx + 2} ${hy - 44}`,
    `C${hx - 14} ${hy - 48} ${hx - 26} ${hy - 36} ${hx - 42} ${hy - 38}`,
    `C${hx - 52} ${hy - 40} ${hx - 56} ${hy - 32} ${hx - 62} ${hy - 26}`,
    `C${hx - 70} ${hy - 20} ${hx - 78} ${hy - 10} ${hx - 82} ${hy + 6}`,
    "Z",
  ].join(" ");
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <radialGradient id="gBoySkin" cx="0.4" cy="0.38" r="0.75">
          <stop offset="0" stopColor={c.skinLight} />
          <stop offset="0.6" stopColor={c.skin} />
          <stop offset="1" stopColor={c.skinShade} />
        </radialGradient>
        <linearGradient id="gBoyNeck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.skinShade} />
          <stop offset="0.5" stopColor={c.skin} />
        </linearGradient>
        <linearGradient id="gBoyShirt" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={c.shirtDark} />
          <stop offset="0.3" stopColor={c.shirtLight} />
          <stop offset="0.7" stopColor={c.shirt} />
          <stop offset="1" stopColor={c.shirtDark} />
        </linearGradient>
        <linearGradient id="gBoyHair" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={c.hairLight} />
          <stop offset="0.6" stopColor={c.hair} />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${y}) rotate(${lean} ${HIP.x} ${HIP.y})`}>
        {/* Buste : t-shirt, col rond, plis légers. */}
        <path d={torso} fill="url(#gBoyShirt)" />
        <path d={`M${cx - 60} ${SHOULDER_Y + 40} Q${cx - 50} ${SHOULDER_Y + 110} ${cx - 64} ${SHOULDER_Y + 170}`} stroke={c.shirtDark} strokeWidth="3" fill="none" opacity="0.18" strokeLinecap="round" />
        <path d={`M${cx + 58} ${SHOULDER_Y + 50} Q${cx + 48} ${SHOULDER_Y + 120} ${cx + 62} ${SHOULDER_Y + 170}`} stroke={c.shirtDark} strokeWidth="3" fill="none" opacity="0.15" strokeLinecap="round" />
        {/* Cou, ombré sous le menton. */}
        <rect x={cx - 24} y={NECK_Y - 30} width="48" height="66" rx="18" fill="url(#gBoyNeck)" />
        <path d={`M${cx - 46} ${NECK_Y + 28} Q${cx} ${NECK_Y + 62} ${cx + 46} ${NECK_Y + 28}`} stroke={c.shirtDark} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={`M${cx - 40} ${NECK_Y + 30} Q${cx} ${NECK_Y + 54} ${cx + 40} ${NECK_Y + 30} Q${cx} ${NECK_Y + 44} ${cx - 40} ${NECK_Y + 30} Z`} fill={c.skinShade} opacity="0.6" />
        <g transform={`rotate(${tilt} ${cx} ${NECK_Y})`}>
          {/* Oreilles. */}
          {[-1, 1].map((s) => (
            <g key={s}>
              <ellipse cx={hx + s * 78} cy={hy + 14} rx="15" ry="22" fill={c.skin} />
              <ellipse cx={hx + s * 80} cy={hy + 14} rx="6" ry="11" fill={c.skinShade} opacity="0.55" />
            </g>
          ))}
          {/* Visage : aucun trait, seulement le modelé de la peau. */}
          <ellipse cx={hx} cy={hy} rx="79" ry="88" fill="url(#gBoySkin)" />
          <ellipse cx={hx} cy={hy + 74} rx="42" ry="12" fill={c.skinShade} opacity="0.18" filter="url(#boySoft)" />
          <path d={hair} fill="url(#gBoyHair)" />
          <path d={`M${hx - 44} ${hy - 88} Q${hx - 6} ${hy - 104} ${hx + 36} ${hy - 92}`} stroke={c.hairLight} strokeWidth="6" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d={`M${hx + 50} ${hy - 58} Q${hx + 10} ${hy - 62} ${hx - 30} ${hy - 48}`} stroke={c.hair} strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
          <path d={`M${hx + 34} ${hy - 72} Q${hx + 62} ${hy - 64} ${hx + 70} ${hy - 34}`} stroke={c.hairLight} strokeWidth="4" fill="none" opacity="0.5" strokeLinecap="round" />
        </g>
      </g>
      <filter id="boySoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
    </svg>
  );
};

/** Main fermée, doigts vers +x, pouce vers −y. */
const Fist: React.FC = () => {
  const c = theme.colors;
  return (
    <g>
      <ellipse cx="10" cy="2" rx="25" ry="21" fill={c.skinShade} />
      <ellipse cx="9" cy="1" rx="23" ry="19" fill={c.skin} />
      {/* Doigts repliés. */}
      {[-8, 1, 10].map((dy, i) => (
        <path key={i} d={`M24 ${dy - 4} Q31 ${dy} 24 ${dy + 4}`} stroke={c.skinShade} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
      ))}
      <ellipse cx="4" cy="-8" rx="10" ry="6" fill={c.skinLight} opacity="0.6" />
      {/* Pouce. */}
      <ellipse cx="14" cy="-17" rx="13" ry="7.5" fill={c.skinShade} transform="rotate(-12 14 -17)" />
      <ellipse cx="13" cy="-18" rx="11.5" ry="6" fill={c.skin} transform="rotate(-12 13 -18)" />
    </g>
  );
};

/** Main ouverte, paume vers le spectateur, doigts vers +x, pouce écarté vers −y. */
const OpenHand: React.FC = () => {
  const c = theme.colors;
  const fingers = [[-13, 26, -6], [-4.5, 30, -2], [4.5, 28, 2], [12.5, 22, 7]];
  return (
    <g>
      {fingers.map(([dy, len, spread], i) => (
        <g key={i} transform={`translate(18 ${dy}) rotate(${spread})`}>
          <rect x="0" y="-5.5" width={len + 2} height="11" rx="5.5" fill={c.skinShade} />
          <rect x="0" y="-4.5" width={len} height="9" rx="4.5" fill={c.skin} />
        </g>
      ))}
      <g transform="translate(6 -14) rotate(-48)">
        <rect x="0" y="-6" width="26" height="12" rx="6" fill={c.skinShade} />
        <rect x="0" y="-5" width="24" height="10" rx="5" fill={c.skin} />
      </g>
      <ellipse cx="8" cy="0" rx="21" ry="19" fill={c.skinShade} />
      <ellipse cx="8" cy="0" rx="19.5" ry="17.5" fill={c.skin} />
      <path d="M-2 6 Q8 12 20 4" stroke={c.skinShade} strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
      <ellipse cx="4" cy="-6" rx="9" ry="6" fill={c.skinLight} opacity="0.5" />
    </g>
  );
};

/** Un bras : manche courte, avant-bras, main fermée, pouce au-dessus. */
const Arm: React.FC<{ s: Pt; target: Pt; side: number; angle?: number; open?: boolean; handOnly?: boolean }> = ({ s, target, side, angle, open, handOnly }) => {
  const c = theme.colors;
  const { e, h } = elbowOf(s, target, side);
  const sleeveEnd = { x: s.x + (e.x - s.x) * 0.62, y: s.y + (e.y - s.y) * 0.62 };
  const foreAngle = (Math.atan2(h.y - e.y, h.x - e.x) * 180) / Math.PI;
  const a = angle ?? foreAngle;
  // Pouce du côté du haut de la main, quel que soit le sens.
  const flip = Math.cos((a * Math.PI) / 180) < 0 ? -1 : 1;
  const line = (p: Pt, q: Pt) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  const arm = `${line(s, e)} L${h.x.toFixed(1)} ${h.y.toFixed(1)}`;
  // Ourlet de la manche : un trait court, perpendiculaire au bras.
  const ux = (e.x - s.x) / UPPER, uy = (e.y - s.y) / UPPER;
  const hem = line({ x: sleeveEnd.x - uy * 25, y: sleeveEnd.y + ux * 25 }, { x: sleeveEnd.x + uy * 25, y: sleeveEnd.y - ux * 25 });
  const hand = (
    <g transform={`translate(${h.x} ${h.y}) rotate(${a}) scale(1.3 ${1.3 * flip})`}>
      {open ? <OpenHand /> : <Fist />}
    </g>
  );
  if (handOnly) return hand;
  return (
    <g>
      <path d={arm} stroke={c.skinShade} strokeWidth="40" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={arm} stroke={c.skin} strokeWidth="35" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={line({ x: e.x - 4, y: e.y - 4 }, { x: h.x - 4, y: h.y - 4 })} stroke={c.skinLight} strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.55" />
      {/* Manche : de la couleur du t-shirt, sans contour du côté de l'épaule. */}
      <path d={line(s, sleeveEnd)} stroke={c.shirt} strokeWidth="54" fill="none" strokeLinecap="round" />
      <path d={line({ x: s.x - side * 6, y: s.y - 8 }, { x: sleeveEnd.x - side * 6, y: sleeveEnd.y - 8 })} stroke={c.shirtLight} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d={hem} stroke={c.shirtDark} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
      {hand}
    </g>
  );
};

/**
 * Bras et mains. `part` : "arms" (bras seuls, derrière ce que tient le
 * garçon), "hands" (mains seules, devant), ou les deux ensemble.
 */
export const BoyArms: React.FC<{ pose: BoyPose; part?: "all" | "arms" | "hands" }> = ({ pose, part = "all" }) => {
  const s = shoulders(pose);
  const handOnly = part === "hands";
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <Arm s={s.l} target={pose.l} side={-1} angle={pose.lAngle} open={pose.lOpen} handOnly={handOnly} />
      <Arm s={s.r} target={pose.r} side={1} angle={pose.rAngle} open={pose.rOpen} handOnly={handOnly} />
    </svg>
  );
};

/** Table en bois clair, sur toute la largeur : dessus en `TABLE_TOP`, chant en `TABLE_EDGE`. */
export const TABLE_TOP = 520;
export const TABLE_EDGE = 588;
export const Table: React.FC = () => {
  const c = theme.colors;
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="gTableTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.wood} />
          <stop offset="1" stopColor={c.woodLight} />
        </linearGradient>
        <linearGradient id="gTableEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.wood} />
          <stop offset="1" stopColor={c.woodDark} />
        </linearGradient>
      </defs>
      <rect x="-20" y={TABLE_TOP} width="1320" height={TABLE_EDGE - TABLE_TOP} fill="url(#gTableTop)" />
      {/* Veines du bois, fuyantes. */}
      {[0.25, 0.55, 0.8].map((t, i) => (
        <path key={i} d={`M-20 ${TABLE_TOP + (TABLE_EDGE - TABLE_TOP) * t} C300 ${TABLE_TOP + (TABLE_EDGE - TABLE_TOP) * t - 4} 900 ${TABLE_TOP + (TABLE_EDGE - TABLE_TOP) * t + 5} 1300 ${TABLE_TOP + (TABLE_EDGE - TABLE_TOP) * t}`} stroke={c.woodDark} strokeWidth="2" fill="none" opacity="0.18" />
      ))}
      {/* Le chant dépasse le bas de l'image : la sortie de scène fait remonter le décor. */}
      <rect x="-20" y={TABLE_EDGE} width="1320" height={720 - TABLE_EDGE + 80} fill="url(#gTableEdge)" />
      <rect x="-20" y={TABLE_EDGE} width="1320" height="4" fill="#FFFFFF" opacity="0.35" />
      <rect x="-20" y={TABLE_TOP} width="1320" height="3" fill={c.woodDark} opacity="0.35" />
    </svg>
  );
};

/** Interpolation d'un point, avec courbe d'accélération et bornes. */
export function movePt(frame: number, range: [number, number], from: Pt, to: Pt, easing = theme.ease.inOut): Pt {
  const opts = { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return { x: interpolate(frame, range, [from.x, to.x], opts), y: interpolate(frame, range, [from.y, to.y], opts) };
}

/**
 * Trajet d'une main par étapes : `keys` = [image, point] triés ; entre deux
 * étapes, la main glisse avec la courbe inOut.
 */
export function path(frame: number, keys: [number, Pt][]): Pt {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (frame <= keys[i][0]) return movePt(frame, [keys[i - 1][0], keys[i][0]], keys[i - 1][1], keys[i][1]);
  }
  return keys[keys.length - 1][1];
}

/**
 * Scène avec le garçon : buste, table, bras, puis `children` (ce qui est posé
 * sur la table ou tenu) : les bras passent toujours derrière les objets, pour
 * ne jamais cacher un verre ou un fruit. Viennent ensuite `held` (un objet
 * serré dans le poing, comme un couteau), puis les mains, par-dessus tout ce
 * qu'elles tiennent ; `front` vient tout devant (gouttes, éclats).
 */
export const BoyScene: React.FC<{ pose: BoyPose; children?: React.ReactNode; held?: React.ReactNode; front?: React.ReactNode; behind?: React.ReactNode }> = ({ pose, children, held, front, behind }) => (
  <>
    {behind}
    <BoyBody pose={pose} />
    <Table />
    <BoyArms pose={pose} part="arms" />
    {children}
    {held}
    <BoyArms pose={pose} part="hands" />
    {front}
  </>
);
