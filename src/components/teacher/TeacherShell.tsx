"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpen, ChartNoAxesColumn, LayoutDashboard, LogOut, Menu, Mic, Presentation, Users, UsersRound, X,
  type LucideIcon,
} from "lucide-react";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { ICON_STROKE } from "@/components/platform/ui";

interface NavItem { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }
interface NavGroup { label?: string; items: NavItem[]; adminOnly?: boolean }

const NAV: NavGroup[] = [
  {
    items: [
      // Ordre du travail : la classe, ses leçons, le cours en direct, puis la progression.
      { href: "/teacher", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/teacher/classes", label: "Mes classes", icon: Users },
      { href: "/teacher#lecons", label: "Leçons", icon: BookOpen },
      { href: "/teacher/present", label: "Cours en direct", icon: Presentation },
      { href: "/teacher#progression", label: "Progression", icon: ChartNoAxesColumn },
    ],
  },
  // Mêmes restrictions que le proxy et les API : réservé aux admins.
  { label: "Bibliothèque audio", adminOnly: true, items: [{ href: "/teacher/letters", label: "Enregistrements vocaux", icon: Mic }] },
  { label: "Administration", adminOnly: true, items: [{ href: "/teacher/equipe", label: "Équipe enseignante", icon: UsersRound }] },
];

function Logo() {
  return (
    <Link href="/teacher" className="flex items-end gap-2 rounded-lg min-h-11" aria-label="Monte & Souris, tableau de bord">
      <BrandMark className="w-8 h-8" />
      <span className="flex flex-col leading-none">
        <span className="text-[10px] text-ms-muted leading-none" style={{ fontStyle: "italic" }}>ASBL</span>
        <Wordmark className="leading-none" />
      </span>
    </Link>
  );
}

function NavList({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'espace enseignant" className="flex flex-col gap-6">
      {NAV.filter((g) => !g.adminOnly || isAdmin).map((group, gi) => (
        <div key={gi}>
          {group.label && <p className="px-3 pb-2 text-[0.8125rem] leading-[1.125rem] font-medium text-ms-muted">{group.label}</p>}
          <ul className="flex flex-col gap-1">
            {group.items.map(({ href, label, icon: Icon }) => {
              // Les ancres du tableau de bord ne sont pas des pages : seul « Tableau de bord » est marqué actif sur /teacher.
              const current = !href.includes("#") && pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center gap-3 min-h-11 px-3 rounded-xl text-[0.9375rem] leading-[1.375rem] font-semibold transition-colors duration-[140ms] ${
                      current ? "bg-ms-primary-soft text-ms-ink" : "text-ms-ink hover:bg-ms-surface-muted"
                    }`}
                  >
                    <Icon size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Account({ name, isAdmin, onLogout }: { name: string; isAdmin: boolean; onLogout: () => void }) {
  return (
    <div className="border-t border-ms-line pt-4 flex flex-col gap-2">
      <p className="px-3 text-sm leading-5">
        <span className="font-semibold">{name}</span>
        {isAdmin && <span className="text-ms-muted"> · admin</span>}
      </p>
      <button type="button" onClick={onLogout}
        className="flex items-center gap-3 min-h-11 px-3 rounded-xl text-[0.9375rem] font-semibold text-ms-muted hover:bg-ms-surface-muted hover:text-ms-ink transition-colors duration-[140ms]">
        <LogOut size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> Déconnexion
      </button>
    </div>
  );
}

/**
 * Coque de l'espace enseignant : barre latérale dès 1024 px, sinon en-tête
 * avec un bouton « Menu » qui ouvre la navigation dans un panneau (Radix
 * Dialog : focus piégé, Échap, retour du focus).
 */
export default function TeacherShell({ name, isAdmin, onLogout, children }: {
  name: string; isAdmin: boolean; onLogout: () => void; children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div data-ms-app="" data-ms-area="teacher" className="min-h-dvh bg-ms-canvas text-ms-ink">
      <a href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-ms-surface focus:px-4 focus:py-3 focus:font-semibold">
        Aller au contenu
      </a>

      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-60 flex-col gap-8 border-r border-ms-line bg-ms-surface px-3 py-5">
        <div className="px-3"><Logo /></div>
        <div className="flex-1 overflow-y-auto"><NavList isAdmin={isAdmin} /></div>
        <Account name={name} isAdmin={isAdmin} onLogout={onLogout} />
      </aside>

      <header className="lg:hidden sticky top-0 z-30 flex min-h-[4.5rem] items-center justify-between gap-3 border-b border-ms-line bg-ms-surface px-4 sm:px-6">
        <Logo />
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button type="button" data-variant="secondary" className="ms-button">
              <Menu size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> Menu
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-ms-ink/30" />
            <Dialog.Content
              data-ms-app="" data-ms-area="teacher"
              className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,100vw)] flex-col gap-6 bg-ms-surface px-3 py-4 shadow-[var(--ms-shadow-dialog)] ms-safe-bottom"
            >
              <div className="flex items-center justify-between gap-3 px-3">
                <Dialog.Title className="text-xl font-semibold">Menu</Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" data-variant="quiet" className="ms-button" aria-label="Fermer le menu">
                    <X size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">Pages de l&apos;espace enseignant</Dialog.Description>
              <div className="flex-1 overflow-y-auto"><NavList isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} /></div>
              <Account name={name} isAdmin={isAdmin} onLogout={onLogout} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <div className="lg:pl-60">
        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[80rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
