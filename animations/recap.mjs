// Rend une vidéo récapitulative de cours en direct, lancé par le site
// (src/lib/recapVideo.ts) :
//   node recap.mjs recap-lettres props.json sortie.mp4
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const [id, propsFile, outputLocation] = process.argv.slice(2);
const inputProps = JSON.parse(fs.readFileSync(propsFile, "utf8"));

// Les clips des mots (staticFile) sont lus dans le public/ du site.
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("../public") });
const composition = await selectComposition({ serveUrl, id, inputProps });
await renderMedia({ composition, serveUrl, inputProps, codec: "h264", crf: 23, outputLocation, muted: true });
console.log(outputLocation);
