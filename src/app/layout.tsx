import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monte & Souris — École Montessori",
  description: "ASBL Monte & Souris : une école Montessori bienveillante pour épanouir l'enfant à son rythme.",
  keywords: ["Montessori", "école", "pédagogie", "enfants", "apprentissage", "ASBL"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Fredoka+One&family=Caveat:wght@400;600;700&family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F5EFE6]">{children}</body>
    </html>
  );
}
