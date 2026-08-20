"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/",         label: "Accueil" },
  { href: "/#courses", label: "Nos cours" },
  { href: "/#about",   label: "Notre approche" },
  { href: "/#contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#FFFDF8]/95 backdrop-blur-md border-b border-[#EDE5D8]" style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          {/* Logo */}
          <div className="relative w-10 h-10 flex items-end justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="group-hover:scale-110 transition-transform">
              {/* plus basse à gauche */}
              <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
              {/* moyenne au centre */}
              <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
              {/* plus haute à droite */}
              <rect x="28" y="10"  width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
              <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
            </svg>
          </div>
          <div className="h-10 flex flex-col justify-between py-0.5">
            <p className="text-xs text-[#2D2D2D]/50 leading-none" style={{ fontFamily: "'Caveat', cursive" }}>
              ASBL
            </p>
            <span className="font-black text-xl text-[#2D2D2D] leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Monte <span className="text-[#2D2D2D]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-full text-sm font-semibold text-[#2D2D2D]/65 hover:text-[#BB908E] hover:bg-[#F5EEE6] transition-all"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="px-5 py-2 rounded-full text-[#2D2D2D] font-bold text-sm border border-[#2D2D2D]/20 hover:bg-[#2D2D2D]/5 hover:shadow-md hover:scale-105 transition-all"
          >
            Espace élève ✦
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-full hover:bg-[#F5EEE6] transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} color="#2D2D2D" /> : <Menu size={22} color="#2D2D2D" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#FFFDF8] border-t border-[#EDE5D8] px-4 py-4 flex flex-col gap-2">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="py-2 px-3 rounded-2xl font-semibold text-[#2D2D2D] hover:bg-[#F5EEE6] hover:text-[#BB908E] transition-colors"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="mt-2 py-2 px-3 rounded-2xl text-[#2D2D2D] font-bold text-center border border-[#2D2D2D]/20 hover:bg-[#2D2D2D]/5"
            onClick={() => setOpen(false)}
          >
            Espace élève / enseignant ✦
          </Link>
        </div>
      )}
    </header>
  );
}
