// Rend chaque dessin WordArt en SVG statique pour la page de relecture.
// Exécution : npx tsx docs/redesign/vocab/render-wordart.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WordArt, hasWordArt } from "../../../src/components/student/WordArt";
import { VOCAB_THEMES } from "../../../src/data/arabicVocabulary";

const out = join(process.cwd(), "docs/redesign/vocab/draw");
mkdirSync(out, { recursive: true });
let n = 0;
for (const theme of VOCAB_THEMES) {
  for (const word of theme.words) {
    if (!hasWordArt(word.id)) continue;
    const svg = renderToStaticMarkup(<WordArt wordId={word.id} />).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    writeFileSync(join(out, `${word.id}.svg`), svg);
    n += 1;
  }
}
console.log("dessins rendus :", n);
