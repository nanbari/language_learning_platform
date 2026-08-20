import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#2D2D2D] text-white mt-20 relative overflow-hidden">

      {/* Arcs décoratifs en fond */}
      <div className="absolute bottom-0 left-0 opacity-10 pointer-events-none">
        <svg width="200" height="100" viewBox="0 0 200 100" fill="none">
          <path d="M0,100 Q50,20 100,100"  stroke="#BB908E" strokeWidth="3" strokeLinecap="round"/>
          <path d="M80,100 Q150,10 220,100" stroke="#999B84" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="absolute bottom-0 right-0 opacity-10 pointer-events-none">
        <svg width="200" height="100" viewBox="0 0 200 100" fill="none">
          <path d="M0,100 Q50,20 100,100"  stroke="#6B705C" strokeWidth="3" strokeLinecap="round"/>
          <path d="M80,100 Q150,10 220,100" stroke="#CCB9B5" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-14 grid grid-cols-1 md:grid-cols-4 gap-8">

        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
              <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
              <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
              <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
            </svg>
            <div className="flex flex-col leading-none mt-2">
              <p className="text-xs text-white/40 -mb-1" style={{ fontFamily: "'Caveat', cursive" }}>
                ASBL
              </p>
              <span className="font-black text-lg" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Monte & Souris
              </span>
            </div>
          </div>
          <p className="text-white/50 text-sm leading-relaxed">
            Cours particuliers de mathématiques inspirés de la pédagogie Montessori — enfants 3-12 ans en présentiel, ados 12-15 ans en ligne.
          </p>
          <p className="mt-3 text-white/30 text-xs" style={{ fontFamily: "'Caveat', cursive", fontSize: "1rem" }}>
            Avec ♡ pour chaque élève
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="font-bold text-[#BB908E] mb-4 text-sm uppercase tracking-wide">Navigation</h3>
          <ul className="space-y-2 text-sm text-white/50">
            {[["Accueil", "/"], ["Nos cours", "/courses"], ["Notre approche", "/about"], ["Actualités", "/news"], ["Contact", "/contact"]].map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="hover:text-[#BB908E] transition-colors flex items-center gap-1.5">
                  <span className="text-[#BB908E]/40">›</span> {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Plateforme */}
        <div>
          <h3 className="font-bold text-[#8BA3B1] mb-4 text-sm uppercase tracking-wide">Plateforme</h3>
          <ul className="space-y-2 text-sm text-white/50">
            {[["Connexion", "/login"], ["Espace enseignant", "/teacher"], ["Espace élève", "/student"]].map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="hover:text-[#8BA3B1] transition-colors flex items-center gap-1.5">
                  <span className="text-[#8BA3B1]/40">›</span> {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="font-bold text-[#6B705C] mb-4 text-sm uppercase tracking-wide">Contact</h3>
          <ul className="space-y-3 text-sm text-white/50">
            <li className="flex items-start gap-2">
              <MapPin size={14} className="text-[#BB908E] mt-0.5 shrink-0" />
              Rue Edmond Tollenaere, 1020 Bruxelles
            </li>
            <li className="flex items-center gap-2">
              <Phone size={14} className="text-[#8BA3B1] shrink-0" />
              +32 499 28 97 66
            </li>
            <li className="flex items-center gap-2">
              <Mail size={14} className="text-[#6B705C] shrink-0" />
              nabilaanbari@zohomail.eu
            </li>
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10 px-4 py-4 text-center text-xs text-white/25">
        © {new Date().getFullYear()} Monte & Souris — Cours de mathématiques · Bruxelles
      </div>
    </footer>
  );
}
