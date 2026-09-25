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

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5" />
      <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5" />
      <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5" />
      <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight text-ms-ink ${className}`}>
      Monte <span className="text-ms-ink">&</span> So<span className="text-ms-blush">u</span>ri<span className="text-ms-sage">s</span>
    </span>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ms-sand bg-ms-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">

        <Link href="/" className="flex items-center gap-3" aria-label="Monte & Souris, accueil">
          <Logo />
          <span className="flex flex-col leading-none">
            <span className="text-[11px] font-semibold text-ms-ink/50">ASBL</span>
            <Wordmark className="text-xl" />
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ms-ink/70 transition-colors duration-300 hover:bg-ms-cream hover:text-ms-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex">
          <Link
            href="/login"
            className="rounded-full border border-ms-ink/15 px-5 py-2 text-sm font-bold text-ms-ink transition-all duration-300 ease-out-soft hover:border-ms-moss hover:text-ms-moss active:scale-[0.98]"
          >
            Espace élève
          </Link>
        </div>

        <button
          type="button"
          className="rounded-full p-2 text-ms-ink transition-colors hover:bg-ms-cream md:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t border-ms-sand bg-ms-white px-4 py-4 md:hidden">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-2xl px-3 py-2.5 font-semibold text-ms-ink transition-colors hover:bg-ms-cream"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="mt-2 rounded-full bg-ms-moss px-3 py-2.5 text-center font-bold text-ms-cream"
            onClick={() => setOpen(false)}
          >
            Espace élève
          </Link>
        </div>
      )}
    </header>
  );
}
