/**
 * Primitives de l'espace enseignant, appuyées sur les classes .ms-* de
 * platform-tokens.css (à utiliser sous [data-ms-app]).
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Info } from "lucide-react";

export const ICON_STROKE = 1.75;

type Variant = "primary" | "secondary" | "quiet" | "danger";

export function Button({ variant = "secondary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" {...props} data-variant={variant} className={`ms-button ${className}`} />;
}

export function ButtonLink({ variant = "secondary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} data-variant={variant} className={`ms-button ${className}`} />;
}

export type PillState = "success" | "neutral" | "review" | "info" | "outline" | "error";

/** Statut non interactif : toujours un libellé texte, l'icône ne fait que l'accompagner. */
export function StatusPill({ state, icon: Icon, children }: { state: PillState; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="ms-status whitespace-nowrap" data-state={state === "neutral" ? undefined : state}>
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Section de premier niveau : titre, description courte, actions éventuelles. */
export function SectionHeader({ id, title, description, actions }: { id?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-[65ch]">
        <h2 id={id} className="text-xl leading-7 font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="mt-1 text-sm leading-5 text-ms-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-ms-muted max-w-[52ch] mx-auto">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Message en ligne : information (après une action) ou erreur (chargement, enregistrement). */
export function InlineNotice({ tone = "info", children, action }: { tone?: "info" | "error"; children: ReactNode; action?: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-sm ${
        tone === "error" ? "bg-ms-danger-soft text-ms-danger" : "bg-ms-info-soft text-ms-info"
      }`}
    >
      <Icon size={18} strokeWidth={ICON_STROKE} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/** Lignes squelettes statiques, de la forme du contenu attendu. */
export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="ms-skeleton h-4 w-32" />
          <div className="ms-skeleton h-4 flex-1 max-w-64" />
          <div className="ms-skeleton h-4 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}
