import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monte & Souris | Cours de langue Montessori pour enfants",
  description:
    "Cours de langue en ligne pour les enfants à partir de 4 ans : pédagogie Montessori, petits groupes de 6 élèves maximum, plateforme de révision incluse.",
  keywords: ["cours de langue", "enfants", "Montessori", "en ligne", "Bruxelles", "ASBL"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${nunito.variable}`}>
      <head>
        {/* Polices héritées, encore référencées en dur par les pages de la plateforme (Fredoka One, Caveat, Cairo, Noto Naskh Arabic). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Caveat:wght@400;600;700&family=Cairo:wght@400;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ms-cream text-ms-ink antialiased">{children}</body>
    </html>
  );
}
