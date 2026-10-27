/**
 * Illustrations des mots de vocabulaire qu'une photo sert mal : les couleurs,
 * les chiffres, la famille, le corps, et les personnes de l'école. Même
 * grammaire que les vignettes de thème (ThemeArt) : formes pleines, lumière
 * douce, objets reconnaissables. Les couleurs à apprendre sont les vraies
 * couleurs, pas celles de la charte. Décoratives pour les lecteurs d'écran :
 * le mot est toujours écrit à côté.
 */
const INK = "#2A2B27";
const SAND = "#EDE5D8";
const SKIN = "#E6C3A5";
const SKIN_DARK = "#C9A07E";

const Ground = ({ rx = 46 }: { rx?: number }) => <ellipse cx="80" cy="106" rx={rx} ry="6" fill={SAND} />;

/* ── Les couleurs : une tablette de couleur Montessori ── */
const COLORS: Record<string, string> = {
  c1: "#C9453B", c2: "#3B6FB6", c3: "#4E9A51", c4: "#E8C33A", c5: "#FFFDF8",
  c6: "#2A2B27", c7: "#E8893A", c8: "#E9A0B5", c9: "#7C5AA6", c10: "#8B5E3C",
};
function Tablet({ color }: { color: string }) {
  return (
    <>
      <Ground rx={50} />
      <rect x="30" y="40" width="100" height="56" rx="6" fill="#D8C3A3" />
      <rect x="40" y="44" width="80" height="48" rx="3" fill={color} stroke={color === "#FFFDF8" ? "#DAD3C7" : "none"} strokeWidth="2" />
    </>
  );
}

/* ── Les chiffres : la barre rouge et bleue, et le chiffre ── */
function Rod({ n }: { n: number }) {
  const seg = n <= 5 ? 22 : 13;
  const w = seg * n;
  const x = 80 - w / 2;
  return (
    <>
      <Ground rx={54} />
      <g transform={`translate(${x} 34)`}>
        {Array.from({ length: n }, (_, i) => (
          <rect key={i} x={i * seg} y="0" width={seg} height="22" rx={i === 0 || i === n - 1 ? 3 : 0} fill={i % 2 === 0 ? "#C9453B" : "#3B6FB6"} />
        ))}
      </g>
      <text x="80" y="96" textAnchor="middle" fontSize="38" fontWeight="700" fontFamily="system-ui, sans-serif" fill={INK}>{n}</text>
    </>
  );
}

/* ── La famille : une personne, à sa taille et avec sa coiffure ── */
type Hair = "short" | "long" | "bun" | "grey" | "greybun" | "none";
function Person({ x = 80, h, head, fill, hair, glasses = false, cane = false }: {
  x?: number; h: number; head: number; fill: string; hair: Hair; glasses?: boolean; cane?: boolean;
}) {
  const top = 108 - h;
  const cy = top - head - 4;
  const hairFill = hair.startsWith("grey") ? "#B8B5AE" : "#4A3528";
  return (
    <g>
      {hair === "long" && <ellipse cx={x} cy={cy + head * 0.5} rx={head * 1.15} ry={head * 1.25} fill={hairFill} />}
      <circle cx={x} cy={cy} r={head} fill={SKIN} />
      {(hair === "short" || hair === "grey") && <path d={`M${x - head} ${cy - head * 0.1}a${head} ${head} 0 0 1 ${head * 2} 0a${head * 1.1} ${head * 0.9} 0 0 0 -${head * 2} 0z`} fill={hairFill} />}
      {hair === "long" && <path d={`M${x - head} ${cy - head * 0.1}a${head} ${head} 0 0 1 ${head * 2} 0a${head * 1.1} ${head * 0.9} 0 0 0 -${head * 2} 0z`} fill={hairFill} />}
      {(hair === "bun" || hair === "greybun") && (
        <>
          <path d={`M${x - head} ${cy - head * 0.1}a${head} ${head} 0 0 1 ${head * 2} 0a${head * 1.1} ${head * 0.9} 0 0 0 -${head * 2} 0z`} fill={hairFill} />
          <circle cx={x} cy={cy - head * 1.05} r={head * 0.45} fill={hairFill} />
        </>
      )}
      <circle cx={x - head * 0.35} cy={cy + head * 0.05} r={head * 0.09} fill={INK} />
      <circle cx={x + head * 0.35} cy={cy + head * 0.05} r={head * 0.09} fill={INK} />
      <path d={`M${x - head * 0.3} ${cy + head * 0.45}q${head * 0.3} ${head * 0.25} ${head * 0.6} 0`} stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {glasses && <g stroke={INK} strokeWidth="1.5" fill="none"><circle cx={x - head * 0.35} cy={cy + head * 0.05} r={head * 0.28} /><circle cx={x + head * 0.35} cy={cy + head * 0.05} r={head * 0.28} /><path d={`M${x - head * 0.07} ${cy + head * 0.05}h${head * 0.14}`} /></g>}
      <path d={`M${x - h * 0.4} 108v-${h * 0.72}a${h * 0.4} ${h * 0.4} 0 0 1 ${h * 0.8} 0V108z`} fill={fill} />
      {cane && <path d={`M${x + h * 0.48} ${108 - h * 0.55}v${h * 0.55}`} stroke="#8B5E3C" strokeWidth="4" strokeLinecap="round" />}
    </g>
  );
}
function family(props: Omit<Parameters<typeof Person>[0], "x">) {
  function FamilyArt() { return (<><Ground rx={40} /><Person {...props} /></>); }
  return FamilyArt;
}

/* ── Le corps ── */
function Face({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <Ground rx={40} />
      <circle cx="80" cy="64" r="40" fill={SKIN} />
      <path d="M40 60a40 40 0 0 1 80 0a44 34 0 0 0 -80 0z" fill="#4A3528" />
      {children}
    </>
  );
}
const ART: Record<string, () => React.JSX.Element> = {
  // Couleurs
  ...Object.fromEntries(Object.entries(COLORS).map(([id, c]) => [id, () => <Tablet color={c} />])),
  // Chiffres
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`n${i + 1}`, () => <Rod n={i + 1} />])),
  // Famille
  f1: family({ h: 60, head: 12, fill: "#4E6F8C", hair: "short" }),
  f2: family({ h: 58, head: 12, fill: "#B5566A", hair: "long" }),
  f3: family({ h: 40, head: 10, fill: "#5B8C5A", hair: "short" }),
  f4: family({ h: 38, head: 10, fill: "#D98A5A", hair: "long" }),
  f5: family({ h: 56, head: 12, fill: "#6B6E73", hair: "grey", glasses: true, cane: true }),
  f6: family({ h: 54, head: 12, fill: "#8C6E8C", hair: "greybun", glasses: true }),
  f7: family({ h: 60, head: 12, fill: "#9A7A4E", hair: "short" }),
  f8: family({ h: 58, head: 12, fill: "#4E9A8C", hair: "bun" }),
  f9: family({ h: 30, head: 9, fill: "#4E6F8C", hair: "short" }),
  f10: family({ h: 30, head: 9, fill: "#B5566A", hair: "long" }),
  // Corps
  b1: () => (
    <Face>
      <circle cx="66" cy="66" r="3.5" fill={INK} /><circle cx="94" cy="66" r="3.5" fill={INK} />
      <path d="M72 82q8 7 16 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </Face>
  ),
  b2: () => (
    <>
      <Ground rx={44} />
      <path d="M28 66q52-44 104 0q-52 44-104 0z" fill="#FFFDF8" stroke={INK} strokeWidth="2.5" />
      <circle cx="80" cy="66" r="18" fill="#5A7F5C" /><circle cx="80" cy="66" r="8" fill={INK} /><circle cx="86" cy="60" r="3" fill="#FFFDF8" />
      <path d="M40 54q40-26 80 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  b3: () => (
    <>
      <Ground rx={36} />
      <path d="M74 30v44l-12 10a10 10 0 0 0 10 10h16a10 10 0 0 0 10-10l-12-10V30z" fill={SKIN} />
      <path d="M62 84a10 10 0 0 0 10 10h16a10 10 0 0 0 10-10" fill={SKIN_DARK} opacity=".5" />
      <ellipse cx="72" cy="90" rx="4" ry="2.5" fill={SKIN_DARK} /><ellipse cx="88" cy="90" rx="4" ry="2.5" fill={SKIN_DARK} />
    </>
  ),
  b4: () => (
    <>
      <Ground rx={44} />
      <path d="M34 62q23-20 46-8q23-12 46 8q-23 36-46 36q-23 0-46-36z" fill="#C9453B" />
      <path d="M34 62q46 8 92 0" stroke="#8E2E26" strokeWidth="2.5" fill="none" />
    </>
  ),
  b5: () => (
    <>
      <Ground rx={30} />
      <path d="M60 60c0-26 16-36 34-30s14 26 8 42-2 24-10 30-22 2-26-8-6-20-6-34z" fill={SKIN} />
      <path d="M72 62c0-12 10-18 20-14s8 16 4 26" stroke={SKIN_DARK} strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
  b6: () => (
    <>
      <Ground rx={40} />
      <path d="M58 108V68a7 7 0 0 1 14 0v22h2V40a7 7 0 0 1 14 0v50h2V36a7 7 0 0 1 14 0v54h2V48a7 7 0 0 1 14 0v38c0 14-10 22-24 22z" fill={SKIN} />
      <path d="M58 68c-6-2-14 2-10 10l10 16z" fill={SKIN} />
    </>
  ),
  b7: () => (
    <>
      <Ground rx={46} />
      <path d="M66 26h20v44c18 2 34 10 40 22a8 8 0 0 1-8 8H58a8 8 0 0 1-8-8c0-10 6-18 16-22z" fill={SKIN} />
      <path d="M100 86h10M86 90h8M76 92h6" stroke={SKIN_DARK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  b8: () => (
    <>
      <Ground rx={40} />
      <path d="M80 100 36 58a22 22 0 0 1 44-20a22 22 0 0 1 44 20z" fill="#C9453B" />
      <path d="M50 46a12 12 0 0 1 14-10" stroke="#FFFDF8" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />
    </>
  ),
  b9: () => (
    <>
      <Ground rx={40} />
      <circle cx="80" cy="70" r="36" fill={SKIN} />
      <path d="M38 76c-4-40 20-56 42-56s48 16 42 56c-6-20-14-30-22-30-4 10-10 14-20 14s-16-4-20-14c-8 0-16 10-22 30z" fill="#4A3528" />
      <circle cx="68" cy="76" r="3" fill={INK} /><circle cx="92" cy="76" r="3" fill={INK} />
    </>
  ),
  b10: () => (
    <>
      <Ground rx={44} />
      <path d="M32 58q48-30 96 0q-14 42-48 42t-48-42z" fill="#C9453B" />
      <path d="M44 62h72v10a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6z" fill="#FFFDF8" />
      <path d="M56 62v16M68 62v16M80 62v16M92 62v16M104 62v16" stroke="#DAD3C7" strokeWidth="1.5" />
    </>
  ),
  // La nourriture : le verre de lait (aucune photo libre convenable)
  fo4: () => (
    <>
      <Ground rx={30} />
      <path d="M56 30h48l-6 76a6 6 0 0 1-6 6H68a6 6 0 0 1-6-6z" fill="#E9F0F4" stroke="#B7C7D1" strokeWidth="2" />
      <path d="M60 50h40l-4 54a4 4 0 0 1-4 4H68a4 4 0 0 1-4-4z" fill="#FFFDF8" />
      <path d="M62 50h36" stroke="#DAD3C7" strokeWidth="1.5" />
    </>
  ),
  // L'école : le livre ouvert (les photos trouvées étaient des manuscrits anciens)
  s1: () => (
    <>
      <Ground rx={54} />
      <path d="M24 44c0-4 3-6 6-6h40c6 0 10 4 10 8v52c-4-4-8-6-12-6H30c-3 0-6 2-6 0z" fill="#FFFDF8" stroke="#8BA3B1" strokeWidth="2" />
      <path d="M80 46c0-4 4-8 10-8h40c3 0 6 2 6 6v50c0 2-3 0-6 0H92c-4 0-8 2-12 6z" fill="#FFFDF8" stroke="#8BA3B1" strokeWidth="2" />
      <path d="M34 52h30M34 62h30M34 72h22M94 52h30M94 62h30M94 72h22" stroke="#DAD3C7" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M80 46v56" stroke="#8BA3B1" strokeWidth="2" />
      <rect x="20" y="96" width="120" height="8" rx="3" fill="#8BA3B1" />
    </>
  ),
  // L'école : les personnes
  s4: () => (
    <>
      <Ground rx={54} />
      <rect x="20" y="26" width="86" height="56" rx="4" fill="#3F5F4A" />
      <path d="M32 44h40M32 56h28" stroke="#FFFDF8" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <Person x={124} h={58} head={12} fill="#4E6F8C" hair="bun" />
    </>
  ),
  s5: () => (
    <>
      <Ground rx={54} />
      <rect x="24" y="78" width="70" height="8" rx="2" fill="#D8C3A3" /><rect x="30" y="86" width="6" height="22" fill="#B89B74" /><rect x="82" y="86" width="6" height="22" fill="#B89B74" />
      <rect x="40" y="70" width="34" height="8" rx="2" fill="#FFFDF8" stroke="#DAD3C7" strokeWidth="1.5" />
      <Person x={116} h={40} head={10} fill="#5B8C5A" hair="short" />
      <rect x="128" y="76" width="16" height="22" rx="5" fill="#C9453B" />
    </>
  ),
  // La nature : le vent
  na10: () => (
    <>
      <Ground rx={54} />
      <path d="M24 50h70a12 12 0 1 0-12-12M30 70h96a12 12 0 1 1-12 12M40 90h50a10 10 0 1 1-10 10" stroke="#7F9DB1" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M112 44c8-6 16-2 16 6s-10 8-16-6zM56 100c6-8 14-6 16 0s-8 8-16 0z" fill="#8FA97E" />
    </>
  ),
};

/** Un dessin pour ce mot, ou null s'il a une photo (ou rien). */
export function WordArt({ wordId, className = "" }: { wordId: string; className?: string }) {
  const Art = ART[wordId];
  if (!Art) return null;
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" focusable="false">
      <Art />
    </svg>
  );
}

export const hasWordArt = (wordId: string) => wordId in ART;
