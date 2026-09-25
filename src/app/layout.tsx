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
  title: "Monte & Souris | Maths Montessori à Bruxelles",
  description:
    "Cours particuliers de mathématiques inspirés de la pédagogie Montessori : à domicile à Bruxelles pour les 3-12 ans, en visio pour les 12-15 ans, préparation au CE1D.",
  keywords: ["Montessori", "mathématiques", "cours particuliers", "Bruxelles", "CE1D", "soutien scolaire", "ASBL"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${nunito.variable}`}>
      <head>
        {/* Polices héritées, encore référencées en dur par les pages de la plateforme (Fredoka One, Cairo). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ms-cream text-ms-ink antialiased">{children}</body>
    </html>
  );
}
