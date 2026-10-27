import { DM_Sans, Noto_Naskh_Arabic } from "next/font/google";

/* Polices de l'espace enseignant (docs/monte-souris-redesign.md, § 4.2).
   Ce layout ne fait que déclarer les variables CSS : seules les pages qui
   posent data-ms-area="teacher" les utilisent. */
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
  // Sans police de repli locale (Arial sous Windows) : elle a des glyphes
  // arabes et passerait devant Noto Naskh Arabic dans la pile de polices.
  adjustFontFallback: false,
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  // Le contenu arabe est toujours en 400 (.ms-arabic) : une seule graisse à charger.
  weight: ["400"],
  variable: "--font-noto-naskh-arabic",
  display: "swap",
});

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${dmSans.variable} ${notoNaskh.variable} contents`}>{children}</div>;
}
