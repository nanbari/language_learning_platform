import { Noto_Naskh_Arabic } from "next/font/google";

/* Polices de l'espace élève (docs/monte-souris-redesign.md, § 4.2) : Nunito
   vient du layout racine ; Noto Naskh Arabic est servie ici par next/font.
   Seules les pages qui posent data-ms-area="student" utilisent ces variables. */
const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  // Le contenu arabe est toujours en 400 (.ms-arabic) : une seule graisse à charger.
  weight: ["400"],
  variable: "--font-noto-naskh-arabic",
  display: "swap",
});

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${notoNaskh.variable} contents`}>{children}</div>;
}
