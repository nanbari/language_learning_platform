// Rendu de la vidéo d'introduction d'une leçon par GitHub Actions (.github/workflows/recap.yml) :
//   RECAP_REQUEST='{"lessonId":"…"}' npx tsx scripts/make-recap.mts
import { makeRecap, type RecapRequest } from "@/lib/recapVideo";

const request = JSON.parse(process.env.RECAP_REQUEST ?? "") as RecapRequest;
makeRecap(request).then(
  () => console.log("vidéo et diaporama à jour dans la leçon"),
  (e) => { console.error(e); process.exit(1); },
);
