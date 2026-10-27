import type { Metadata } from "next";
import { Caveat, Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// Une seule graisse : le logo et les titres du site public n'en utilisent pas d'autre.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

// Le « ASBL » du logo, et rien d'autre : une graisse, un sous-ensemble.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Monte & Souris | Cours de langue Montessori pour enfants",
  description:
    "Cours de langue en ligne pour les enfants à partir de 4 ans : pédagogie Montessori, petits groupes de 6 élèves maximum, plateforme de révision incluse.",
  keywords: ["cours de langue", "enfants", "Montessori", "en ligne", "Bruxelles", "ASBL"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${nunito.variable} ${caveat.variable}`}>
      {/* Toutes les polices passent par next/font (auto-hébergées, préchargées, sans CSS externe
          bloquant). « Fredoka One » est devenue Fredoka 700 ; Noto Naskh Arabic est chargée par
          les layouts qui en ont besoin (élève, enseignant, connexion). */}
      <body className="min-h-screen bg-ms-cream text-ms-ink antialiased">{children}</body>
    </html>
  );
}
