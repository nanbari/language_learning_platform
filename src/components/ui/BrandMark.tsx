/**
 * Logo de l'association : trois marches qui montent, et l'étoile. Même dessin
 * que dans l'en-tête et la page de connexion, à la taille voulue par `className`.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-3 -3 46 46" overflow="visible" fill="none" className={className} aria-hidden="true">
      {/* plus basse à gauche */}
      <rect x="1" y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5" />
      {/* moyenne au centre */}
      <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5" />
      {/* plus haute à droite */}
      <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5" />
      <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
    </svg>
  );
}

/** Le nom de l'association, avec ses lettres de couleur. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-black text-[#2D2D2D] ${className ?? ""}`} style={{ fontFamily: "'Fredoka One', cursive" }}>
      Monte <span className="text-[#8BA3B1]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
    </span>
  );
}
