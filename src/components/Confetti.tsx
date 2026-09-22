"use client";
import { motion } from "framer-motion";

// Teintes de la charte graphique.
const CONFETTI_COLORS = ["#BB908E", "#CCB9B5", "#8BA3B1", "#6B705C", "#999B84", "#7B868E"];

/**
 * Pluie de confettis d'une réussite — cours en direct comme exercices de la
 * plateforme. Positions dérivées de l'indice pour rester pur au rendu.
 */
export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden>
      {Array.from({ length: 60 }, (_, i) => {
        const left = (i * 37) % 100;
        const size = 8 + ((i * 13) % 10);
        return (
          <motion.span
            key={i}
            className="absolute top-0 block"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 1.6,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              borderRadius: i % 3 === 0 ? "50%" : 2,
            }}
            initial={{ y: "-10vh", rotate: 0, opacity: 1 }}
            animate={{ y: "110vh", rotate: 360 + ((i * 53) % 360), x: ((i * 29) % 120) - 60, opacity: [1, 1, 0.8, 0] }}
            transition={{ duration: 2.2 + ((i * 7) % 12) / 10, delay: ((i * 11) % 8) / 10, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}
