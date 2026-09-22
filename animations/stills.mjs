// Images fixes de contrôle : node stills.mjs pomme-couper:42 pomme-jus:80 …
// Écrites dans out/<id>-<frame>.png, pour vérifier une scène avant le rendu.
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";

const outDir = path.resolve("out");
fs.mkdirSync(outDir, { recursive: true });

const wanted = process.argv.slice(2).map((arg) => {
  const [id, frame] = arg.split(":");
  return { id, frame: Number(frame) };
});
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const compositions = await getCompositions(serveUrl);

for (const { id, frame } of wanted) {
  const composition = compositions.find((c) => c.id === id);
  if (!composition) { console.log(`inconnue : ${id}`); continue; }
  const output = path.join(outDir, `${id}-${frame}.png`);
  await renderStill({ composition, serveUrl, frame, output, overwrite: true });
  console.log(output);
}
