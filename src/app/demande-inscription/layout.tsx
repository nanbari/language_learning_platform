import type { Metadata } from "next";

// Titre et description repris dans l'aperçu du lien (WhatsApp, Instagram, Facebook).
export const metadata: Metadata = {
  title: "Demande d'inscription aux cours d'arabe | Monte & Souris",
  description:
    "Cours d'arabe en ligne pour les enfants non arabophones de 4 à 12 ans, en petit groupe de 6 élèves maximum, inspirés de la pédagogie Montessori.",
};

export default function EnrollmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
