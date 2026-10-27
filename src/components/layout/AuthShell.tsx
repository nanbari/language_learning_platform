"use client";
import Link from "next/link";
import { useState, type ReactNode, type Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, BookOpen, Eye, EyeOff, LineChart, Radio } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";

/*
 * Cadre des pages de compte (connexion, mot de passe oublié, nouveau mot de
 * passe). Sur grand écran, un panneau de marque dans le rose de la charte à
 * gauche et le formulaire à droite ; sur téléphone, une seule colonne.
 * Typographie et champs de l'espace enseignant (data-ms-area="teacher") :
 * les polices sont posées par le layout de chaque route (authFonts.ts).
 */

const ICON_STROKE = 1.75;

function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="inline-flex min-h-11 items-end gap-3 rounded-xl" aria-label="Monte & Souris, accueil">
      <BrandMark className={size === "lg" ? "h-14 w-14" : "h-10 w-10"} />
      <span className="flex flex-col leading-none">
        <span className="text-xs leading-none text-ms-muted" style={{ fontStyle: "italic" }}>ASBL</span>
        <Wordmark className={`${size === "lg" ? "text-3xl" : "text-xl"} leading-none`} />
      </span>
    </Link>
  );
}

/** Ce que la plateforme réunit : une ligne par espace, l'icône en simple repère, sans vignette. */
const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: BookOpen, text: "Des leçons à suivre à son rythme" },
  { icon: Radio, text: "Les cours en direct avec l'enseignant" },
  { icon: LineChart, text: "Le suivi des progrès de chaque élève" },
];

function BrandPanel() {
  return (
    <aside className="hidden min-w-0 flex-col justify-between gap-12 border-e border-ms-line bg-ms-blush-soft p-12 lg:flex xl:p-16">
      <Logo size="lg" />
      <div className="max-w-[28rem]">
        <p className="text-[2rem] font-semibold leading-10 tracking-[-0.02em]">
          Apprendre l&apos;arabe, pas à pas.
        </p>
        <p className="mt-3 text-ms-muted">L&apos;espace d&apos;apprentissage des élèves et des enseignants de Monte &amp; Souris.</p>
        <ul className="mt-10 flex flex-col gap-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-lg leading-7">
              <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ms-primary" />
              <span className="font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-ms-muted">Monte &amp; Souris ASBL · Bruxelles</p>
    </aside>
  );
}

const DEFAULT_FOOTER = (
  <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-ms-primary underline-offset-4 hover:underline">Retour à la connexion</Link>
);

export function AuthShell({ title, subtitle, children, footer = DEFAULT_FOOTER }: {
  title: string; subtitle: string; children: ReactNode;
  /** Ligne sous la carte ; par défaut, le retour à la connexion. */
  footer?: ReactNode;
}) {
  return (
    <div data-ms-app="" data-ms-area="teacher"
      className="min-h-dvh bg-ms-canvas text-ms-ink lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BrandPanel />
      <main className="flex min-h-dvh min-w-0 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] sm:text-[2rem] sm:leading-10">{title}</h1>
          <p className="mt-1 text-ms-muted">{subtitle}</p>
          <div className="ms-panel mt-8 p-6 shadow-[var(--ms-shadow-control)] sm:p-8">{children}</div>
          {footer && <p className="mt-6 text-center text-sm leading-5 text-ms-muted">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

/** Champ de formulaire : libellé au-dessus (8 px), aide et erreur associées par aria-describedby. */
export function AuthField({ id, label, action, hint, children }: {
  id: string; label: string; action?: ReactNode; hint?: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold leading-5">{label}</label>
        {action}
      </div>
      {children}
      {hint && <p id={`${id}-hint`} className="text-[0.8125rem] leading-[1.125rem] text-ms-muted">{hint}</p>}
    </div>
  );
}

/** Mot de passe avec bouton Afficher / Masquer (cible de 44 px). */
export function PasswordInput({ id, value, onChange, describedBy, invalid, autoComplete, minLength, show, onToggle }: {
  id: string; value: string; onChange: (v: string) => void; describedBy?: string; invalid?: boolean;
  autoComplete: string; minLength?: number;
  /** Visibilité contrôlée (pour afficher deux champs ensemble) ; sinon gérée ici. */
  show?: boolean; onToggle?: () => void;
}) {
  const [ownShow, setOwnShow] = useState(false);
  const visible = show ?? ownShow;
  const toggle = onToggle ?? (() => setOwnShow((s) => !s));
  return (
    <div className="relative">
      <input
        id={id} type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        required minLength={minLength} autoComplete={autoComplete}
        aria-describedby={describedBy} aria-invalid={invalid || undefined}
        className="ms-field pe-14"
      />
      <button type="button" onClick={toggle} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute end-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ms-muted hover:bg-ms-surface-muted hover:text-ms-ink">
        {visible ? <EyeOff size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Eye size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Erreur du formulaire, annoncée et focalisable (le focus y est porté après un envoi raté). */
export function AuthError({ id, message, ref }: { id: string; message: string; ref?: Ref<HTMLDivElement> }) {
  if (!message) return null;
  return (
    <div ref={ref} id={id} role="alert" tabIndex={-1}
      className="flex items-start gap-3 rounded-xl bg-ms-danger-soft px-4 py-3 text-sm leading-5 text-ms-danger">
      <AlertCircle size={18} strokeWidth={ICON_STROKE} className="mt-px shrink-0" aria-hidden="true" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
    </div>
  );
}

/** Classe des champs : le champ partagé .ms-field (sous data-ms-app). */
export const authInputClass = "ms-field";

/** Classe des boutons pleine largeur : à combiner avec data-variant="primary" | "secondary". */
export const authButtonClass = "ms-button w-full";
