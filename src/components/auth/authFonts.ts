import { DM_Sans } from "next/font/google";

/* Polices des pages de compte (connexion, mot de passe) : la même
   typographie que l'espace enseignant (docs/monte-souris-redesign.md, § 4.2).
   Déclarées une seule fois ici et posées par les layouts de ces routes. */
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
  // Sans police de repli locale (Arial sous Windows) : elle a des glyphes
  // arabes et passerait devant Noto Naskh Arabic dans la pile de polices.
  adjustFontFallback: false,
});

/** Classes à poser sur un ancêtre des pages de compte (aucun texte arabe : pas de Naskh à charger). */
export const authFontVariables = dmSans.variable;
