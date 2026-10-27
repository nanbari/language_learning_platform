"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Presentation, Radio, Users } from "lucide-react";
import { fetchLessons, deleteLesson as apiDeleteLesson, type ApiLesson } from "@/lib/api/lessons";
import { fetchTeacherInsights } from "@/lib/api/teacher";
import { fetchTeacherClasses } from "@/lib/api/classes";
import type { ClassRow } from "@/lib/classes";
import type { TeacherInsights } from "@/lib/teacherInsights";
import TeacherShell from "@/components/teacher/TeacherShell";
import { useTeacherSession } from "@/components/teacher/useTeacherSession";
import RequestInbox from "@/components/teacher/RequestInbox";
import ProgressWorkspace from "@/components/teacher/ProgressWorkspace";
import { DeckStatusPill } from "@/components/teacher/DeckStatusPill";
import { Button, ButtonLink, EmptyState, ICON_STROKE, InlineNotice, SectionHeader, SkeletonRows, StatusPill } from "@/components/platform/ui";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/** Séance en direct : l'action utile, avec l'état réel des classes. */
function SessionPanel({ classes, lessons }: { classes: ClassRow[] | null; lessons: ApiLesson[] | null }) {
  const live = classes?.filter((c) => c.live) ?? [];
  return (
    <section aria-labelledby="seance" className="ms-panel flex flex-col gap-4 p-4 sm:p-5" style={{ background: "var(--ms-slate-soft)" }}>
      <div>
        <h2 id="seance" className="flex items-center gap-3 text-xl leading-7 font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ms-surface text-ms-slate-ink">
            <Radio size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </span>
          Séance en direct
        </h2>
        <p className="mt-1 text-sm text-ms-muted max-w-[60ch]">
          Choisissez une leçon et une classe, puis lancez le cours : les élèves de la classe le rejoignent depuis leur espace.
        </p>
      </div>
      {live.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <StatusPill state="info" icon={Radio}>Cours ouvert</StatusPill>
          {live.map((c) => c.name).join(", ")}
        </p>
      )}
      <p className="text-sm tabular-nums">
        {classes === null ? "…" : plural(classes.length, "classe")} · {lessons === null ? "…" : plural(lessons.length, "leçon")}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink href="/teacher/present" variant="primary">
          <Presentation size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Préparer une séance
        </ButtonLink>
        <ButtonLink href="/teacher/classes" variant="secondary">
          <Users size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Mes classes
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * Une leçon : ses activités, sa classe (lien vers l'espace de la classe), l'état
 * de son diaporama, et ses actions. La suppression demande une confirmation.
 */
function LessonRowItem({ lesson, className, onDelete }: { lesson: ApiLesson; className: string | undefined; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const activities = lesson.blocks.length;
  const exercises = lesson.blocks.filter((b) => b.type === "exercise").length;
  const date = new Date(lesson.createdAt).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{lesson.title}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ms-muted">
          <span className="tabular-nums">
            {plural(activities, "activité")}{exercises > 0 && ` dont ${plural(exercises, "exercice")}`}
          </span>
          <span aria-hidden="true">·</span>
          <span>créée le <time dateTime={lesson.createdAt}>{date}</time></span>
          <span aria-hidden="true">·</span>
          {lesson.classId
            ? (
              <Link
                href={`/teacher/classes#${lesson.classId}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg font-medium text-ms-ink underline decoration-ms-line underline-offset-4 hover:decoration-ms-ink"
                title="Ouvrir l'espace de la classe"
              >
                <Users size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
                <span className="sr-only">Classe : </span>{className ?? "Classe"}
              </Link>
            )
            : <StatusPill state="review">Aucune classe : invisible pour les élèves</StatusPill>}
          <span aria-hidden="true">·</span>
          <DeckStatusPill lesson={lesson} />
        </p>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Supprimer « ${lesson.title} »`}>
          <span className="text-sm font-semibold">Supprimer cette leçon ?</span>
          <Button variant="danger" disabled={deleting} onClick={async () => { setDeleting(true); await onDelete(); }}>
            {deleting ? "Suppression…" : "Supprimer"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>Annuler</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/teacher/create?edit=${lesson.id}`} variant="secondary">Modifier</ButtonLink>
          <ButtonLink href={`/student/lesson/${lesson.id}`} variant="quiet">Voir comme un élève</ButtonLink>
          <Button variant="quiet" className="text-ms-danger" onClick={() => setConfirming(true)}>Supprimer</Button>
        </div>
      )}
    </li>
  );
}

function TeacherPageInner() {
  const { user, isAdmin, handleLogout } = useTeacherSession();
  const router = useRouter();
  const params = useSearchParams();

  const [lessons, setLessons] = useState<ApiLesson[] | null>(null);
  const [lessonsError, setLessonsError] = useState(false);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  // « Leçon publiée. » : lu une fois à l'arrivée depuis l'éditeur (?published=1), puis l'adresse est nettoyée.
  const [showPublished, setShowPublished] = useState(() => params.get("published") === "1");
  // Progression réelle des élèves, calculée côté serveur depuis exercise_events.
  const [insights, setInsights] = useState<TeacherInsights | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchLessons(user.id)
      .then((l) => { setLessons(l); setLessonsError(false); })
      .catch(() => { setLessons([]); setLessonsError(true); });
    fetchTeacherClasses().then(({ classes }) => setClasses(classes)).catch(() => setClasses([]));
    fetchTeacherInsights()
      .then((i) => { setInsights(i); setInsightsError(null); })
      .catch((err) => setInsightsError(err instanceof Error ? err.message : "Erreur inattendue"));
  }, [user]);

  useEffect(() => {
    if (params.get("published") !== "1") return;
    const timer = setTimeout(() => setShowPublished(false), 3500);
    router.replace("/teacher");
    return () => clearTimeout(timer);
  }, [params, router]);

  const deleteLesson = async (id: string) => {
    await apiDeleteLesson(id).catch(() => {});
    setLessons((prev) => (prev ?? []).filter((l) => l.id !== id));
  };

  const classNames = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const firstName = user?.name?.split(" ")[0];

  return (
    <TeacherShell name={user?.name || "Enseignant"} isAdmin={isAdmin} onLogout={handleLogout}>
      <div className="space-y-8 lg:space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] leading-9 lg:text-[2rem] lg:leading-10 font-semibold tracking-[-0.02em]">Tableau de bord</h1>
            {firstName && <p className="mt-1 text-ms-muted">Bonjour, {firstName}</p>}
          </div>
          <ButtonLink href="/teacher/create" variant="primary">
            <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Créer une leçon
          </ButtonLink>
        </header>

        {showPublished && <InlineNotice>Leçon publiée.</InlineNotice>}

        <div className={`grid items-start gap-4 lg:gap-6 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
          <SessionPanel classes={classes} lessons={lessons} />
          {isAdmin && <RequestInbox />}
        </div>

        <ProgressWorkspace insights={insights} error={insightsError} classes={classes ?? []} />

        <section aria-labelledby="lecons-h" id="lecons" className="scroll-mt-24 space-y-4">
          <SectionHeader
            id="lecons-h"
            title="Mes leçons"
            description={lessons && lessons.length > 0 ? plural(lessons.length, "leçon") : undefined}
            actions={<ButtonLink href="/teacher/create" variant="secondary"><Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Créer une leçon</ButtonLink>}
          />
          <div className="ms-panel overflow-hidden">
            {lessons === null && <SkeletonRows rows={3} label="Chargement des leçons" />}
            {lessonsError && <div className="p-4"><InlineNotice tone="error">Vos leçons n&apos;ont pas pu être chargées. Rechargez la page.</InlineNotice></div>}
            {lessons && !lessonsError && lessons.length === 0 && (
              <EmptyState
                title="Préparez votre première leçon"
                text="Ajoutez une activité, puis associez la leçon à une classe."
                action={<ButtonLink href="/teacher/create" variant="primary">Créer une leçon</ButtonLink>}
              />
            )}
            {lessons && lessons.length > 0 && (
              <ul className="divide-y divide-ms-line">
                {lessons.map((lesson) => (
                  <LessonRowItem key={lesson.id} lesson={lesson}
                    className={lesson.classId ? classNames.get(lesson.classId) : undefined}
                    onDelete={() => deleteLesson(lesson.id)} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </TeacherShell>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ms-canvas" aria-busy="true" />}>
      <TeacherPageInner />
    </Suspense>
  );
}
