"use client";
import dynamic from "next/dynamic";

/**
 * Confettis chargés à la demande : framer-motion n'est téléchargé qu'à la
 * première réussite, pas au chargement de la leçon.
 */
export const LazyConfetti = dynamic(() => import("@/components/Confetti").then((m) => m.Confetti), { ssr: false });
