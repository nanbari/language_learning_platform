/**
 * Découpe d'un mot arabe autour d'une lettre à colorer.
 *
 * Colorer une lettre, c'est l'isoler dans son propre élément HTML ; certains
 * navigateurs mettent alors en forme chaque morceau séparément et la lettre
 * se détache de ses voisines. Un liant de largeur nulle (ZWJ) de part et
 * d'autre de chaque coupure force les formes liées, comme dans le mot entier.
 */

const ZWJ = "‍";
const DIACRITICS = /[ً-ْٰ]/g;
/** Lettres qui ne s'attachent pas à la suivante. */
const NON_CONNECTORS = new Set(["ا", "أ", "إ", "آ", "د", "ذ", "ر", "ز", "و", "ؤ", "ة", "ى", "ء"]);

export interface WordSegments {
  before: string;
  target: string;
  after: string;
}

export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, "");
}

/** « كِ[تَ]اب » → { before: "كِ", target: "تَ", after: "اب" }. */
export function splitMarkedWord(marked: string): WordSegments {
  const match = /^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/.exec(marked);
  if (!match) throw new Error(`Mot mal balisé : ${marked}`);
  return { before: match[1], target: match[2], after: match[3] };
}

/** Les deux lettres de part et d'autre d'une coupure s'attachent-elles ? */
function joins(left: string, right: string): boolean {
  const last = stripDiacritics(left).at(-1);
  const first = stripDiacritics(right).at(0);
  return !!last && !!first && !NON_CONNECTORS.has(last) && first !== "ء";
}

/** Morceaux prêts à l'affichage : les liaisons survivent à la coloration. */
export function joinedSegments(marked: string): WordSegments {
  const { before, target, after } = splitMarkedWord(marked);
  const leftJoin = joins(before, target) ? ZWJ : "";
  const rightJoin = joins(target, after) ? ZWJ : "";
  return {
    before: before + leftJoin,
    target: leftJoin + target + rightJoin,
    after: rightJoin + after,
  };
}
