// Rendu d'une vidéo récapitulative par GitHub Actions (.github/workflows/recap.yml) :
//   RECAP_REQUEST='{"kind":"vocab","lessonId":"…"}' RECAP_AUTHOR=<id> npx tsx scripts/make-recap.mts
import { makeRecap, type RecapRequest } from "@/lib/recapVideo";

const request = JSON.parse(process.env.RECAP_REQUEST ?? "") as RecapRequest;
makeRecap(request, process.env.RECAP_AUTHOR ?? "").then(
  () => console.log("vidéo à jour dans la leçon"),
  (e) => { console.error(e); process.exit(1); },
);
