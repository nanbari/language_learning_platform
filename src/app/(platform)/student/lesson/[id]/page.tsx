"use client";
import { useState, use, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { fetchLessons, type ApiLesson } from "@/lib/api/lessons";
import { LessonPlayer, type StoredLesson } from "@/components/lesson/LessonPlayer";
import { STUDENT_ICON } from "@/components/student/StudentShell";
import { accentAt } from "@/components/student/accents";

/* ─────────────────────────────────────────────
   Main lesson page — le déroulé est dans LessonPlayer (partagé avec l'aperçu
   de l'éditeur de leçons).
───────────────────────────────────────────── */
export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lesson,     setLesson]     = useState<StoredLesson | null | "loading">("loading");
  const [allLessons, setAllLessons] = useState<ApiLesson[]>([]);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    (async () => {
      const all = await fetchLessons().catch(() => [] as ApiLesson[]);
      setAllLessons(all);
      const found = all.find((l) => l.id === id);
      setLesson((found as unknown as StoredLesson) ?? null);
    })();
  }, [id]);

  // Un enseignant qui prévisualise la leçon revient sur son propre tableau de bord.
  const isTeacher = user?.role === "teacher";
  const home = isTeacher ? "/teacher" : "/student";
  const homeLabel = isTeacher ? "Tableau de bord" : "Mes leçons";
  const backLabel = isTeacher ? "Retour au tableau de bord" : "Retour à mes leçons";

  if (lesson === "loading") {
    return (
      <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas" aria-busy="true">
        {/* Même en-tête que la leçon (5,25 rem) : le contenu ne saute pas quand elle arrive. */}
        <div className="sticky top-0 z-40 border-b border-ms-line bg-ms-surface">
          <div className="mx-auto flex min-h-20 max-w-[66rem] items-center px-4 sm:px-6"><div className="ms-skeleton h-8 w-40" /></div>
          <div className="h-1 bg-ms-surface-muted" aria-hidden="true" />
        </div>
        <div className="mx-auto flex max-w-[52rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <div className="ms-skeleton h-2 w-full rounded-full" />
          <div className="ms-skeleton h-72 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas flex items-center justify-center px-4">
        <div className="text-center flex flex-col items-center gap-4">
          <p className="text-2xl font-extrabold">Cette leçon est introuvable.</p>
          <Link href={home} data-variant="primary" className="ms-button">
            <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  // Même rotation que les cartes de l'accueil élève : la leçon garde sa couleur.
  const accent = accentAt(allLessons.findIndex((l) => l.id === id));

  return <LessonPlayer lesson={lesson} accent={accent} home={home} homeLabel={homeLabel} backLabel={backLabel} />;
}
