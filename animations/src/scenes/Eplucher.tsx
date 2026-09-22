import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { FRUIT_SHADOW, GroundShadow, SceneFrame, useBreathe, useEnter } from "../components/Motion";

/**
 * Éplucher : la banane entre debout ; la tige se casse, puis la peau s'ouvre
 * en trois pans qui basculent vers l'extérieur et pendent le long du fruit,
 * face interne claire visible. La chair apparaît au fur et à mesure que la
 * déchirure descend.
 *
 * La banane est un croissant dessiné dans une boîte 400 × 400 : un axe courbe
 * (quadratique, bombé à droite) et une largeur qui s'effile vers les deux
 * bouts. Le point de contrôle est à mi-hauteur, donc y est linéaire en t.
 */
const SIZE = 470;
const CX = 640, CY = 350;
const SNAP_AT = 18;
const PEEL_FROM = 30, PEEL_TO = 96;
const SKIN_W = 100;
const TOP = { x: 196, y: 48 }, CTRL = { x: 292, y: 204 }, BOTTOM = { x: 214, y: 360 };
const TEAR_START = TOP.y + 2, TEAR_END = TOP.y + 165;

type Pt = { x: number; y: number };
const axis = (t: number): Pt => ({
  x: (1 - t) ** 2 * TOP.x + 2 * (1 - t) * t * CTRL.x + t * t * BOTTOM.x,
  y: (1 - t) ** 2 * TOP.y + 2 * (1 - t) * t * CTRL.y + t * t * BOTTOM.y,
});
const tangent = (t: number): Pt => {
  const x = 2 * (1 - t) * (CTRL.x - TOP.x) + 2 * t * (BOTTOM.x - CTRL.x);
  const y = 2 * (1 - t) * (CTRL.y - TOP.y) + 2 * t * (BOTTOM.y - CTRL.y);
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
};
/** Normale « à gauche » de l'axe, orienté du haut vers le bas. */
const normal = (t: number): Pt => { const { x, y } = tangent(t); return { x: y, y: -x }; };
const tFromY = (y: number) => (y - TOP.y) / (BOTTOM.y - TOP.y);
/** Largeur du fruit le long de l'axe : fine aux bouts, pleine au milieu. */
const widthAt = (t: number) => SKIN_W * (0.5 + 0.5 * Math.sin(Math.PI * t) ** 0.8);

/** Tracé fermé d'un croissant de largeur `scale × widthAt`, bouts arrondis. */
function crescent(scale: number, samples = 40): string {
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, c = axis(t), n = normal(t), w = widthAt(t) * scale / 2;
    left.push({ x: c.x + n.x * w, y: c.y + n.y * w });
    right.push({ x: c.x - n.x * w, y: c.y - n.y * w });
  }
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const capB = axis(1), tB = tangent(1), wB = widthAt(1) * scale * 0.7;
  const capT = axis(0), tT = tangent(0), wT = widthAt(0) * scale * 0.7;
  return [
    `M${f(left[0])}`,
    ...left.slice(1).map((p) => `L${f(p)}`),
    `Q${f({ x: capB.x + tB.x * wB, y: capB.y + tB.y * wB })} ${f(right[samples])}`,
    ...right.slice(0, samples).reverse().map((p) => `L${f(p)}`),
    `Q${f({ x: capT.x - tT.x * wT, y: capT.y - tT.y * wT })} ${f(left[0])}`,
    "Z",
  ].join(" ");
}
/** Ligne le long de l'axe, décalée de `offset × largeur` (arête de la peau ou de la chair). */
function ridge(offset: number, t0 = 0.02, t1 = 0.98, samples = 24): string {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = t0 + (t1 - t0) * (i / samples), c = axis(t), n = normal(t), w = widthAt(t) * offset;
    return `${i === 0 ? "M" : "L"}${(c.x + n.x * w).toFixed(1)} ${(c.y + n.y * w).toFixed(1)}`;
  }).join(" ");
}

/**
 * Pan de peau, dans son repère : base en (0, 0), pointe vers le haut (−y),
 * longueur L, demi-largeur b ; `bend` incline la pointe sur le côté.
 */
function petal(L: number, b: number, bend: number): string {
  const tx = bend * L, ty = -L;
  return `M${-b} 0 C${-b * 1.05} ${-L * 0.4} ${tx - b * 0.55} ${ty * 0.88} ${tx} ${ty} C${tx + b * 0.55} ${ty * 0.88} ${b * 1.05} ${-L * 0.4} ${b} 0 Z`;
}

const SKIN_PATH = crescent(1);
const FLESH_PATH = crescent(0.8);

export const Eplucher: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { skin, flesh, fleshDark } = FRUITS[fruit].palette;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  const enter = useEnter(0);
  const breathe = useBreathe(0.01);

  // Tige : elle se casse et se couche sur le côté, puis suit le premier pan.
  const snap = spring({ frame: frame - SNAP_AT, fps, config: theme.spring.snappy });
  const stemRot = interpolate(snap, [0, 1], [0, -70]);

  // Déchirure : descend lentement, puis franchement.
  const peel = interpolate(frame, [PEEL_FROM, PEEL_TO], [0, 1], { easing: theme.ease.inOut, ...clamp });
  const tearY = interpolate(peel, [0, 1], [TEAR_START, TEAR_END]);
  const tT = tFromY(tearY);
  const tearC = axis(tT), tearN = normal(tT), tearW = widthAt(tT);
  const baseAngle = (Math.atan2(tangent(tT).y, tangent(tT).x) * 180) / Math.PI - 90;

  // Secousse à chaque pan qui cède, et légère torsion du fruit.
  const tug = Math.sin(Math.min(1, spring({ frame: frame - PEEL_FROM, fps, config: theme.spring.bouncy })) * Math.PI) * 0.04;
  const scale = interpolate(enter, [0, 1], [0.6, 1]) * breathe.scale * (1 - tug);
  const tilt = -4 + Math.sin(frame / 26) * 1.5;

  /** Les trois pans : gauche, droit (pivotent vers l'extérieur) et avant (bascule vers le spectateur). */
  const pans = [
    { side: -1, delay: 0, front: false },
    { side: 1, delay: 5, front: false },
    { side: 0, delay: 2, front: true },
  ].map(({ side, delay, front }) => {
    const p = interpolate(frame, [PEEL_FROM + delay, PEEL_TO + delay], [0, 1], { easing: theme.ease.inOut, ...clamp });
    const L = Math.max(0, tearY - TOP.y + 12);
    const b = tearW * (front ? 0.36 : 0.3);
    const hinge = { x: tearC.x + tearN.x * side * (tearW / 2 - 8), y: tearC.y + tearN.y * side * (tearW / 2 - 8) };
    const theta = p * 135;
    // Passé 90°, c'est la face interne (claire) qu'on voit.
    const inner = interpolate(theta, [70, 110], [0, 1], clamp);
    return { side, front, p, L, b, hinge, theta, inner, d: petal(L, b, side * p * 0.35) };
  });

  const Pan: React.FC<{ pan: (typeof pans)[number]; withStem?: boolean }> = ({ pan, withStem }) => {
    const { side, front, hinge, theta, inner, d, L, b } = pan;
    const transform = front
      ? `translate(${hinge.x} ${hinge.y}) rotate(${baseAngle + 14 * pan.p}) scale(${1 + Math.abs(Math.sin((theta * Math.PI) / 180)) * 0.25} ${Math.cos((theta * Math.PI) / 180)})`
      : `translate(${hinge.x} ${hinge.y}) rotate(${baseAngle + side * theta})`;
    const showInner = front ? (Math.cos((theta * Math.PI) / 180) < 0 ? 1 : 0) : inner;
    return (
      <g transform={transform}>
        <path d={d} fill="url(#gPanOuter)" stroke="#B8820F" strokeWidth="2" strokeLinejoin="round" />
        <path d={d} fill="url(#gPanInner)" stroke="#D9B45A" strokeWidth="2" strokeLinejoin="round" opacity={showInner} />
        {/* Fibres de la face interne. */}
        <path d={`M${-b * 0.3} -6 L${-b * 0.15 + side * pan.p * L * 0.3} ${-L * 0.8}`} stroke="#E8D28A" strokeWidth="2" fill="none" opacity={showInner * 0.6} />
        {withStem && (
          <g transform={`translate(${side * pan.p * 0.35 * L} ${-L}) rotate(${stemRot})`}>
            <path d="M-8 4 L-9 -30 Q0 -42 9 -30 L8 4 Z" fill="url(#gStem)" />
            <path d="M-11 -30 Q0 -40 11 -30 Q0 -26 -11 -30 Z" fill="#4F3416" />
          </g>
        )}
      </g>
    );
  };

  return (
    <Stage>
      <SceneFrame>
        <GroundShadow x={CX + 14} y={CY + SIZE * 0.43} width={SIZE * 0.5 * scale} opacity={enter} lift={1 - enter} />
        <div
          style={{
            position: "absolute", left: CX - SIZE / 2, top: CY - SIZE / 2 + breathe.y,
            width: SIZE, height: SIZE, opacity: enter,
            transform: `scale(${scale}) rotate(${tilt}deg) translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
            transformOrigin: "50% 70%",
          }}
        >
          <svg width={SIZE} height={SIZE} viewBox="0 0 400 400" style={{ overflow: "visible", filter: FRUIT_SHADOW }}>
            <defs>
              <clipPath id="skinBelowTear">
                <rect x="-100" y={tearY} width="600" height={500 - tearY} />
              </clipPath>
              {/* Lumière venant de la gauche. */}
              <linearGradient id="gPeelSkin" gradientUnits="userSpaceOnUse" x1="130" y1="0" x2="300" y2="0">
                <stop offset="0" stopColor="#FFE889" />
                <stop offset="0.4" stopColor={skin} />
                <stop offset="1" stopColor="#B07A0C" />
              </linearGradient>
              <linearGradient id="gPeelFlesh" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="280" y2="0">
                <stop offset="0" stopColor="#FFFCEC" />
                <stop offset="0.55" stopColor={flesh} />
                <stop offset="1" stopColor="#E3CF8A" />
              </linearGradient>
              <linearGradient id="gPanOuter" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FFE889" />
                <stop offset="0.5" stopColor={skin} />
                <stop offset="1" stopColor="#C48F14" />
              </linearGradient>
              <linearGradient id="gPanInner" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FFF9E0" />
                <stop offset="0.5" stopColor="#FFF1BE" />
                <stop offset="1" stopColor="#F1DC96" />
              </linearGradient>
              <linearGradient id="gStem" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8A6A2B" />
                <stop offset="1" stopColor="#4F3416" />
              </linearGradient>
            </defs>

            {/* Chair : croissant plus fin, arêtes et bout arrondi plus sombre. */}
            <path d={FLESH_PATH} fill="url(#gPeelFlesh)" stroke={fleshDark} strokeWidth="2" strokeLinejoin="round" />
            <path d={ridge(0.12)} stroke={fleshDark} strokeWidth="2" fill="none" opacity="0.55" />
            <path d={ridge(-0.16)} stroke="#FFFFFF" strokeWidth="5" fill="none" opacity="0.45" strokeLinecap="round" />
            <circle cx={axis(0.02).x} cy={axis(0.02).y} r="11" fill="#D9C27A" opacity="0.6" />

            {/* Peau, du bas jusqu'à la déchirure. */}
            <g clipPath="url(#skinBelowTear)">
              <path d={SKIN_PATH} fill="url(#gPeelSkin)" stroke="#A8720B" strokeWidth="2.5" strokeLinejoin="round" />
              <path d={ridge(0.18)} stroke="#C48F14" strokeWidth="3" fill="none" opacity="0.6" />
              <path d={ridge(-0.2)} stroke="#C48F14" strokeWidth="3" fill="none" opacity="0.5" />
              <path d={ridge(-0.36)} stroke="#FFFFFF" strokeWidth="7" fill="none" opacity="0.28" strokeLinecap="round" />
              {/* Taches brunes de maturité. */}
              {[[0.55, 0.2], [0.62, -0.1], [0.72, 0.3], [0.8, -0.25], [0.88, 0.1], [0.68, 0.05]].map(([t, o], i) => {
                const c = axis(t), n = normal(t), w = widthAt(t) * o;
                return <ellipse key={i} cx={c.x + n.x * w} cy={c.y + n.y * w} rx={3 + (i % 3)} ry={2 + (i % 2)} fill="#6E5018" opacity="0.4" transform={`rotate(${i * 35} ${c.x + n.x * w} ${c.y + n.y * w})`} />;
              })}
              {/* Pointe brune en bas. */}
              <circle cx={axis(0.995).x} cy={axis(0.995).y + 4} r="9" fill="#5C4014" />
            </g>
            {/* Bord de la déchirure. */}
            <path d={`M${tearC.x + tearN.x * tearW / 2} ${tearC.y + tearN.y * tearW / 2} Q${tearC.x} ${tearC.y + 7} ${tearC.x - tearN.x * tearW / 2} ${tearC.y - tearN.y * tearW / 2}`} stroke="#A8720B" strokeWidth="3" fill="none" opacity="0.7" />

            {/* Pans : les deux côtés, puis celui de devant. La tige suit le pan gauche. */}
            <Pan pan={pans[0]} withStem />
            <Pan pan={pans[1]} />
            <Pan pan={pans[2]} />
          </svg>
        </div>
      </SceneFrame>
    </Stage>
  );
};
