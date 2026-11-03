/**
 * Les trois couleurs du logo (bleu ardoise, sauge, rose), attribuées à une
 * leçon selon sa place dans la liste : la carte et la leçon gardent la même
 * couleur. Le rose n'ouvre pas la rotation — il domine déjà le logo.
 *
 * `pastel` est la couleur du logo telle quelle : fonds de boutons (avec un
 * texte foncé, ≥ 5:1), barre de progression, couvertures. `soft` est un fond
 * très clair de la même famille. Aucune teinte n'est assombrie : la charte
 * s'affiche sans variante. Le pastel seul ne délimite jamais un contrôle et
 * ne porte pas de texte sur fond clair (contraste insuffisant).
 */
export interface Accent {
  name: "slate" | "sage" | "blush";
  pastel: string;
  soft: string;
}

const ACCENTS: Accent[] = [
  { name: "slate", pastel: "var(--ms-slate)", soft: "var(--ms-slate-soft)" },
  { name: "sage", pastel: "var(--ms-sage)", soft: "var(--ms-sage-soft)" },
  { name: "blush", pastel: "var(--ms-blush)", soft: "var(--ms-blush-soft)" },
];

/** Valeurs hexadécimales des couleurs du logo, pour les composants qui attendent une couleur littérale. */
export const ACCENT_PASTEL_HEX: Record<Accent["name"], string> = {
  slate: "#8BA3B1",
  sage: "#999B84",
  blush: "#BB908E",
};

/** Style d'un bouton principal aux couleurs de la leçon : fond du logo, texte foncé. */
export const accentButton = (accent: Accent) => ({ background: accent.pastel, color: "var(--ms-ink)" });

export function accentAt(index: number): Accent {
  return ACCENTS[(index >= 0 ? index : 0) % ACCENTS.length];
}
