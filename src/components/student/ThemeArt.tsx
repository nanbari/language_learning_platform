/**
 * Illustrations des thèmes de vocabulaire : une par thème, dessinée ici en
 * formes pleines, même perspective, même échelle, même lumière. Les objets
 * d'apprentissage gardent leurs couleurs naturelles (une pomme reste rouge,
 * un tronc reste brun) ; le reste emprunte à la charte. Décoratives : le
 * titre du thème porte le sens, l'image est masquée aux lecteurs d'écran.
 */
const INK = "#2A2B27";
const SAND = "#EDE5D8";

function Cat() {
  return (
    <>
      <ellipse cx="80" cy="104" rx="46" ry="6" fill={SAND} />
      <path d="M38 96c0-30 10-50 42-50s42 20 42 50z" fill="#CCB9B5" />
      <path d="M48 52 40 22l26 20zM112 52l8-30-26 20z" fill="#CCB9B5" />
      <path d="M50 44 46 30l12 10zM110 44l4-14-12 10z" fill="#BB908E" />
      <circle cx="66" cy="66" r="3.5" fill={INK} />
      <circle cx="94" cy="66" r="3.5" fill={INK} />
      <path d="M77 76h6l-3 4z" fill="#BB908E" />
      <path d="M44 74h18M44 82h18M98 74h18M98 82h18" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
      <path d="M122 96c14-4 18-20 10-30" stroke="#BB908E" strokeWidth="7" strokeLinecap="round" fill="none" />
    </>
  );
}

function Colors() {
  return (
    <>
      <ellipse cx="80" cy="104" rx="46" ry="6" fill={SAND} />
      <circle cx="58" cy="52" r="28" fill="#C96F5F" />
      <circle cx="102" cy="52" r="28" fill="#7F9DB1" opacity=".92" />
      <circle cx="80" cy="82" r="28" fill="#D9B65A" opacity=".9" />
    </>
  );
}

function Numbers() {
  // Les barres rouges et bleues de la pédagogie Montessori : 1, 2, 3.
  const seg = 28;
  return (
    <>
      <ellipse cx="80" cy="106" rx="50" ry="6" fill={SAND} />
      {[1, 2, 3].map((n, row) => (
        <g key={n} transform={`translate(38 ${40 + row * 22})`}>
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={i * seg} y="0" width={seg} height="16" rx={i === 0 ? 3 : 0} fill={i % 2 === 0 ? "#C96F5F" : "#7F9DB1"} />
          ))}
        </g>
      ))}
    </>
  );
}

function Family() {
  const person = (x: number, h: number, head: number, fill: string) => (
    <g key={x}>
      <circle cx={x} cy={108 - h - head - 4} r={head} fill="#E6C3A5" />
      <path d={`M${x - h * 0.42} 108v-${h * 0.75}a${h * 0.42} ${h * 0.42} 0 0 1 ${h * 0.84} 0V108z`} fill={fill} />
    </g>
  );
  return (
    <>
      <ellipse cx="80" cy="108" rx="52" ry="6" fill={SAND} />
      {person(50, 52, 11, "#8BA3B1")}
      {person(84, 58, 12, "#999B84")}
      {person(116, 34, 8, "#BB908E")}
    </>
  );
}

function Body() {
  return (
    <>
      <ellipse cx="80" cy="108" rx="40" ry="6" fill={SAND} />
      <path d="M58 108V68a7 7 0 0 1 14 0v22h2V40a7 7 0 0 1 14 0v50h2V36a7 7 0 0 1 14 0v54h2V48a7 7 0 0 1 14 0v38c0 14-10 22-24 22z" fill="#E6C3A5" />
      <path d="M58 68c-6-2-14 2-10 10l10 16z" fill="#E6C3A5" />
      <rect x="56" y="100" width="48" height="12" rx="4" fill="#8BA3B1" />
    </>
  );
}

function Food() {
  return (
    <>
      <ellipse cx="80" cy="108" rx="52" ry="6" fill={SAND} />
      <path d="M96 98c-14 0-26 3-32 8h66c0-18-8-34-24-38-10 0-10 8-10 30z" fill="#D4A86A" />
      <path d="M68 106c0-22 10-36 28-38" stroke="#FFFDF8" strokeWidth="3" fill="none" opacity=".6" />
      <path d="M46 56c-12 0-22 12-22 26s10 26 22 26c4 0 6-2 10-2s6 2 10 2c12 0 22-12 22-26S78 56 66 56c-4 0-6 2-10 2s-6-2-10-2z" fill="#C96F5F" />
      <path d="M56 56V44" stroke="#6B4F3A" strokeWidth="3" strokeLinecap="round" />
      <path d="M56 50c6-10 16-10 20-6-6 8-14 10-20 6z" fill="#999B84" />
    </>
  );
}

function Nature() {
  return (
    <>
      <ellipse cx="80" cy="108" rx="54" ry="6" fill={SAND} />
      <circle cx="118" cy="34" r="14" fill="#E3C46A" />
      <rect x="60" y="74" width="12" height="34" rx="3" fill="#9B7B5B" />
      <circle cx="66" cy="50" r="26" fill="#7F9C6E" />
      <circle cx="46" cy="62" r="16" fill="#8FA97E" />
      <circle cx="86" cy="64" r="16" fill="#8FA97E" />
      <path d="M100 108c0-16 14-24 28-20-4 12-14 20-28 20z" fill="#999B84" />
    </>
  );
}

function School() {
  return (
    <>
      <ellipse cx="80" cy="108" rx="52" ry="6" fill={SAND} />
      <path d="M30 92V46c0-4 3-6 6-6h34c6 0 10 4 10 8v50c-4-4-8-6-12-6H36c-3 0-6 2-6 0z" fill="#8BA3B1" />
      <path d="M80 48c0-4 4-8 10-8h34c3 0 6 2 6 6v46c0 2-3 0-6 0H92c-4 0-8 2-12 6z" fill="#FFFDF8" stroke="#8BA3B1" strokeWidth="2" />
      <path d="M94 56h26M94 66h26M94 76h18" stroke="#DAD3C7" strokeWidth="2.5" strokeLinecap="round" />
      <g transform="rotate(-35 118 86)">
        <rect x="104" y="80" width="44" height="12" rx="2" fill="#E3C46A" />
        <path d="M148 80h6l6 6-6 6h-6z" fill="#E6C3A5" />
        <path d="M157 83l3 3-3 3z" fill={INK} />
        <rect x="98" y="80" width="6" height="12" fill="#BB908E" />
      </g>
    </>
  );
}

const ART: Record<string, () => React.JSX.Element> = {
  animals: Cat, colors: Colors, numbers: Numbers, family: Family, body: Body, food: Food, nature: Nature, school: School,
};

export function ThemeArt({ themeId, className = "" }: { themeId: string; className?: string }) {
  const Art = ART[themeId];
  if (!Art) return null;
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" focusable="false">
      <Art />
    </svg>
  );
}
