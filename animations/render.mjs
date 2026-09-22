// Rend toutes les compositions (ou celles passées en argument) en MP4 dans
// ../public/animations/fruits, servis par le site aux enseignants et aux élèves.
//   node render.mjs                 → tout
//   node render.mjs pomme-couper    → un seul clip
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

const outDir = path.resolve("../public/animations/fruits");
fs.mkdirSync(outDir, { recursive: true });

const wanted = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const compositions = await getCompositions(serveUrl);
const selected = compositions.filter((c) => wanted.length === 0 || wanted.includes(c.id));

for (const composition of selected) {
  const outputLocation = path.join(outDir, `${composition.id}.mp4`);
  process.stdout.write(`${composition.id} … `);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 20,
    outputLocation,
    // Les clips sont muets : pas de piste audio à encoder.
    muted: true,
  });
  console.log(`${(fs.statSync(outputLocation).size / 1024).toFixed(0)} Ko`);
}
console.log(`${selected.length} clip(s) dans ${outDir}`);
