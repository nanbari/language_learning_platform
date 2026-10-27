/**
 * Les trois pastels de la charte (bleu, vert, rose), attribués à une leçon
 * selon sa place dans la liste : la carte et la leçon gardent la même
 * couleur. Le rose n'ouvre pas la rotation — il domine déjà le logo.
 *
 * `soft` et `pastel` décorent (fonds, couvertures, filets) ; `deep` porte du
 * texte ou un fond de bouton à texte blanc (contrastes ≥ 4,5:1, voir
 * platform-tokens.css). Le pastel seul ne délimite jamais un contrôle.
 */
export interface Accent {
  name: "slate" | "sage" | "blush";
  pastel: string;
  soft: string;
  deep: string;
}

const ACCENTS: Accent[] = [
  { name: "slate", pastel: "var(--ms-slate)", soft: "var(--ms-slate-soft)", deep: "var(--ms-slate-ink)" },
  { name: "sage", pastel: "var(--ms-sage)", soft: "var(--ms-sage-soft)", deep: "var(--ms-sage-ink)" },
  { name: "blush", pastel: "var(--ms-blush)", soft: "var(--ms-blush-soft)", deep: "var(--ms-blush-ink)" },
];

/** Valeurs hexadécimales des teintes profondes, pour les composants qui attendent une couleur littérale. */
export const ACCENT_DEEP_HEX: Record<Accent["name"], string> = {
  slate: "#46606E",
  sage: "#5C5E48",
  blush: "#8A5552",
};

export function accentAt(index: number): Accent {
  return ACCENTS[(index >= 0 ? index : 0) % ACCENTS.length];
}
