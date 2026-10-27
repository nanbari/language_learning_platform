"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";

/** Icônes de l'espace élève : 28 px dans des cibles de 64 px (brief, § 4.4). */
export const STUDENT_ICON = 28;

/**
 * Coque de l'espace élève : le logo d'origine, un bouton « Sortir » à la
 * taille d'un doigt d'enfant, et une colonne de 66 rem au plus.
 */
export default function StudentShell({ children }: { children: ReactNode }) {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    logout();
    router.push("/login");
  };

  return (
    <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas text-ms-ink">
      <a href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-ms-surface focus:px-5 focus:py-4 focus:font-bold">
        Aller au contenu
      </a>
      <header className="border-b border-ms-line bg-ms-surface">
        <div className="mx-auto flex min-h-20 w-full max-w-[66rem] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/student" className="flex min-h-16 items-end gap-2 rounded-2xl py-3" aria-label="Monte & Souris, mes leçons">
            <BrandMark className="h-9 w-9" />
            <span className="flex flex-col leading-none">
              <span className="text-[11px] leading-none text-ms-muted" style={{ fontFamily: "var(--font-caveat), cursive" }}>ASBL</span>
              <Wordmark className="text-lg leading-none" />
            </span>
          </Link>
          <button type="button" onClick={handleLogout} data-variant="quiet" className="ms-button text-ms-muted">
            <LogOut size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Sortir
          </button>
        </div>
      </header>
      <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[66rem] px-4 py-6 sm:px-6 sm:py-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
