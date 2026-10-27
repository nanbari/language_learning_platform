import { Noto_Naskh_Arabic } from "next/font/google";

/* Pages d'arabe en autonomie (vocabulaire, alphabet) : mêmes polices que
   l'espace élève — Nunito vient du layout racine, Noto Naskh Arabic d'ici. */
const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  // Le contenu arabe est toujours en 400 (.ms-arabic) : une seule graisse à charger, comme l'espace élève.
  weight: ["400"],
  variable: "--font-noto-naskh-arabic",
  display: "swap",
});

export default function ArabicLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${notoNaskh.variable} contents`}>{children}</div>;
}
