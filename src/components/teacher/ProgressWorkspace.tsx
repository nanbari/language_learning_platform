"use client";
import { useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CircleCheck, Circle, Eye, Pencil, RotateCcw, Search } from "lucide-react";
import type { AnswerDescriptor, ExerciseStatus, StudentExercise, StudentLesson, StudentProgress, TeacherInsights } from "@/lib/teacherInsights";
import { Button, ButtonLink, EmptyState, ICON_STROKE, InlineNotice, SectionHeader, SkeletonRows, StatusPill, type PillState } from "@/components/platform/ui";

/* ─── Libellés ─────────────────────────────────────────────────────────
   Tous les statuts et erreurs viennent de la dernière tentative de chaque
   exercice (lib/teacherInsights) ; les tentatives précédentes forment
   l'historique, affiché à part. */

const STATUS: Record<ExerciseStatus, { label: string; state: PillState; icon: typeof Check }> = {
  first_try:    { label: "Réussi du premier coup",        state: "success", icon: CircleCheck },
  after_errors: { label: "Réussi après erreurs ou indice", state: "neutral", icon: Check },
  failed:       { label: "À revoir",                       state: "review",  icon: RotateCcw },
  seen:         { label: "Vu, sans réponse",               state: "info",    icon: Eye },
  not_started:  { label: "Pas commencé",                   state: "outline", icon: Circle },
};

const TYPE_LABEL: Record<string, string> = {
  quiz: "Quiz", wordorder: "Remise en ordre", matching: "Appariement", dragdrop: "Tri",
};

/** « Aujourd'hui », « Hier », « Il y a N jours ». */
export function relativeDay(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

function exactDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-BE", { dateStyle: "long", timeStyle: "short" });
}

function ActivityTime({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ms-muted">—</span>;
  return <time dateTime={iso} title={exactDate(iso)} className="whitespace-nowrap">{relativeDay(iso)}</time>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

function Bar({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="h-2 w-20 flex-shrink-0 overflow-hidden rounded-full bg-ms-surface-muted" aria-hidden="true">
        <span className="block h-full rounded-full bg-ms-primary" style={{ width: `${share}%` }} />
      </span>
      <span className="tabular-nums whitespace-nowrap">{done}/{total}</span>
    </span>
  );
}

/** Une réponse (attendue ou choisie) : vignette si image, sinon texte. */
function AnswerChip({ answer, count }: { answer: AnswerDescriptor; count?: number }) {
  const label = answer.text ?? "image";
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-ms-canvas py-1 pl-1 pr-2 text-sm">
      {answer.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={answer.imageUrl} alt={answer.text ? `Image : ${answer.text}` : "Image choisie"} width={32} height={32}
          className="h-8 w-8 flex-shrink-0 rounded-md object-cover" />
      ) : (
        <bdi dir="auto" className="truncate pl-1">{label}</bdi>
      )}
      {count !== undefined && count > 1 && <span className="tabular-nums text-ms-muted" aria-label={`${count} fois`}>×{count}</span>}
    </span>
  );
}

function Answers({ list }: { list: StudentExercise["wrongAnswers"] }) {
  if (list.length === 0) return <span className="text-ms-muted">—</span>;
  return <span className="flex flex-wrap gap-1.5">{list.map((w) => <AnswerChip key={w.key} answer={w} count={w.count} />)}</span>;
}

function History({ ex }: { ex: StudentExercise }) {
  if (ex.earlierWrongAttempts === 0) return <span className="text-ms-muted">Aucune erreur précédente</span>;
  return (
    <span className="flex flex-col gap-1.5">
      <span>{plural(ex.earlierWrongAttempts, "erreur précédente", "erreurs précédentes")}</span>
      {ex.earlierWrongAnswers.length > 0 && <Answers list={ex.earlierWrongAnswers} />}
    </span>
  );
}

function ExerciseName({ ex }: { ex: StudentExercise }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      {ex.correctAnswer?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ex.correctAnswer.imageUrl} alt="" width={40} height={40} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
      )}
      <span className="min-w-0">
        <span className="block font-medium">
          <span className="tabular-nums">{ex.position}.</span> <bdi dir="auto">{ex.label}</bdi>
        </span>
        <span className="block text-[0.8125rem] leading-[1.125rem] text-ms-muted">
          {TYPE_LABEL[ex.type] ?? ex.type}
          {ex.hasAudio && " · consigne audio"}
          {ex.correctAnswer?.text && <> · attendu : <bdi dir="auto" className="font-medium text-ms-ink">{ex.correctAnswer.text}</bdi></>}
        </span>
      </span>
    </span>
  );
}

/* ─── Synthèse par élève ───────────────────────────────────────────── */

function totals(st: StudentProgress) {
  return {
    seen: st.lessons.reduce((n, l) => n + l.exercisesSeen, 0),
    total: st.lessons.reduce((n, l) => n + l.exercisesTotal, 0),
  };
}

function ReviewCount({ n }: { n: number }) {
  return n > 0
    ? <StatusPill state="review" icon={RotateCcw}>{n} à revoir</StatusPill>
    : <span className="text-ms-muted">Rien à revoir</span>;
}

function SummaryTable({ students, selectedId, onSelect }: {
  students: StudentProgress[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="hidden lg:block">
      <table className="w-full text-sm leading-5">
        <caption className="sr-only">Synthèse de la progression par élève</caption>
        <thead>
          <tr className="border-b border-ms-line text-left text-ms-muted">
            <th scope="col" className="px-4 py-3 font-semibold">Élève</th>
            <th scope="col" className="px-4 py-3 font-semibold">Exercices vus</th>
            <th scope="col" className="px-4 py-3 font-semibold">Réussite au premier coup</th>
            <th scope="col" className="px-4 py-3 font-semibold">À revoir</th>
            <th scope="col" className="px-4 py-3 font-semibold">Erreurs</th>
            <th scope="col" className="px-4 py-3 font-semibold">Dernière activité</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Suivi</span></th>
          </tr>
        </thead>
        <tbody>
          {students.map((st) => {
            const { seen, total } = totals(st);
            const selected = st.userId === selectedId;
            return (
              <tr key={st.userId} className={`border-b border-ms-line last:border-b-0 ${selected ? "bg-ms-primary-soft/60" : "hover:bg-ms-canvas/60"}`}>
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  {st.userName}
                  <span className="block text-[0.8125rem] font-normal text-ms-muted">{plural(st.lessons.length, "leçon")}</span>
                </th>
                <td className="px-4 py-3"><Bar done={seen} total={total} /></td>
                <td className="px-4 py-3 tabular-nums">
                  {percent(st.firstTryRate)}
                  {st.exercisesAttempted > 0 && <span className="text-ms-muted"> ({st.firstTrySuccesses}/{st.exercisesAttempted})</span>}
                </td>
                <td className="px-4 py-3"><ReviewCount n={st.toReview} /></td>
                <td className="px-4 py-3 tabular-nums">
                  {plural(st.wrongAttempts, "erreur")}
                  {st.earlierWrongAttempts > 0 && <span className="block text-[0.8125rem] text-ms-muted">historique : {st.earlierWrongAttempts}</span>}
                </td>
                <td className="px-4 py-3"><ActivityTime iso={st.lastActivityAt} /></td>
                <td className="px-4 py-3 text-right">
                  <Button variant={selected ? "primary" : "secondary"} aria-pressed={selected} onClick={() => onSelect(st.userId)}>
                    {selected ? "Suivi affiché" : "Voir le suivi"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryList({ students, onSelect }: { students: StudentProgress[]; onSelect: (id: string) => void }) {
  return (
    <ul className="lg:hidden divide-y divide-ms-line">
      {students.map((st) => {
        const { seen, total } = totals(st);
        return (
          <li key={st.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <p className="font-semibold">{st.userName}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="flex items-center gap-2"><span className="sr-only">Exercices vus :</span><Bar done={seen} total={total} /></span>
                <ReviewCount n={st.toReview} />
                <span className="text-ms-muted"><ActivityTime iso={st.lastActivityAt} /></span>
              </div>
            </div>
            <Button onClick={() => onSelect(st.userId)} className="w-full sm:w-auto">Voir le suivi</Button>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Détail de l'élève sélectionné ────────────────────────────────── */

/** Leçon suivie : ses chiffres, et les deux chemins vers son contenu (voir comme un élève, modifier). */
function LessonHeader({ lesson }: { lesson: StudentLesson }) {
  return (
    <div className="flex flex-col gap-2 text-sm lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        <h4 className="text-base font-semibold [overflow-wrap:anywhere]">{lesson.lessonTitle}</h4>
        <span className="flex items-center gap-2"><span className="text-ms-muted">Vus</span><Bar done={lesson.exercisesSeen} total={lesson.exercisesTotal} /></span>
        <span className="tabular-nums">
          <span className="text-ms-muted">Premier coup </span>{percent(lesson.firstTryRate)}
          {lesson.exercisesAttempted > 0 && <span className="text-ms-muted"> ({lesson.firstTrySuccesses}/{lesson.exercisesAttempted})</span>}
        </span>
        {lesson.toReview > 0 && <StatusPill state="review" icon={RotateCcw}>{lesson.toReview} à revoir</StatusPill>}
        <span className="text-ms-muted">Dernière activité : <ActivityTime iso={lesson.lastActivityAt} /></span>
      </div>
      <div className="flex flex-wrap gap-1 lg:ml-auto">
        <ButtonLink href={`/student/lesson/${lesson.lessonId}`} variant="quiet" aria-label={`Voir « ${lesson.lessonTitle} » comme un élève`}>
          <Eye size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Voir comme un élève
        </ButtonLink>
        <ButtonLink href={`/teacher/create?edit=${lesson.lessonId}`} variant="quiet" aria-label={`Modifier la leçon « ${lesson.lessonTitle} »`}>
          <Pencil size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Modifier la leçon
        </ButtonLink>
      </div>
    </div>
  );
}

function ExerciseTable({ lesson }: { lesson: StudentLesson }) {
  return (
    <div className="hidden lg:block">
      <table className="w-full text-sm leading-5">
        <caption className="sr-only">Exercices de la leçon {lesson.lessonTitle}</caption>
        <thead>
          <tr className="border-b border-ms-line text-left text-ms-muted">
            <th scope="col" className="px-4 py-3 font-semibold w-[30%]">Exercice</th>
            <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
            <th scope="col" className="px-4 py-3 font-semibold">Erreurs</th>
            <th scope="col" className="px-4 py-3 font-semibold">Réponses choisies</th>
            <th scope="col" className="px-4 py-3 font-semibold">Historique</th>
            <th scope="col" className="px-4 py-3 font-semibold">Activité</th>
          </tr>
        </thead>
        <tbody>
          {lesson.exercises.map((ex) => {
            const s = STATUS[ex.status];
            return (
              <tr key={ex.blockId} className="border-b border-ms-line last:border-b-0 align-top">
                <th scope="row" className="px-4 py-3 text-left font-normal"><ExerciseName ex={ex} /></th>
                <td className="px-4 py-3"><StatusPill state={s.state} icon={s.icon}>{s.label}</StatusPill></td>
                <td className={`px-4 py-3 tabular-nums ${ex.wrongAttempts > 0 ? "font-semibold text-ms-review" : "text-ms-muted"}`}>{ex.wrongAttempts}</td>
                <td className="px-4 py-3"><Answers list={ex.wrongAnswers} /></td>
                <td className="px-4 py-3"><History ex={ex} /></td>
                <td className="px-4 py-3"><ActivityTime iso={ex.lastActivityAt} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExerciseList({ lesson }: { lesson: StudentLesson }) {
  return (
    <ul className="lg:hidden divide-y divide-ms-line">
      {lesson.exercises.map((ex) => {
        const s = STATUS[ex.status];
        return (
          <li key={ex.blockId} className="space-y-3 px-4 py-4 text-sm">
            <ExerciseName ex={ex} />
            <StatusPill state={s.state} icon={s.icon}>{s.label}</StatusPill>
            <dl className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
              <dt className="text-ms-muted">Erreurs</dt>
              <dd className={`tabular-nums ${ex.wrongAttempts > 0 ? "font-semibold text-ms-review" : ""}`}>{ex.wrongAttempts}</dd>
              <dt className="text-ms-muted">Réponses choisies</dt>
              <dd className="min-w-0"><Answers list={ex.wrongAnswers} /></dd>
              <dt className="text-ms-muted">Historique</dt>
              <dd className="min-w-0"><History ex={ex} /></dd>
              <dt className="text-ms-muted">Activité</dt>
              <dd><ActivityTime iso={ex.lastActivityAt} /></dd>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function StudentDetail({ student, onBack, headingRef }: {
  student: StudentProgress; onBack: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [lessonId, setLessonId] = useState<string>("all");
  const selectId = useId();
  const lessons = lessonId === "all" ? student.lessons : student.lessons.filter((l) => l.lessonId === lessonId);

  return (
    <section aria-labelledby={`${selectId}-title`} className="ms-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ms-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <Button variant="quiet" onClick={onBack} className="lg:hidden -ml-3 mb-1">
            <ArrowLeft size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> Retour à la liste
          </Button>
          <h3 id={`${selectId}-title`} ref={headingRef} tabIndex={-1} className="scroll-mt-36 text-xl leading-7 font-semibold focus:outline-none">
            Suivi de {student.userName}
          </h3>
          <p className="mt-1 text-sm text-ms-muted">Statut, erreurs et réponses choisies : dernière tentative de chaque exercice.</p>
        </div>
        {student.lessons.length > 1 && (
          <div className="flex flex-col gap-2 w-full sm:w-64">
            <label htmlFor={selectId} className="text-sm font-semibold">Leçon</label>
            <select id={selectId} value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="ms-field">
              <option value="all">Toutes les leçons</option>
              {student.lessons.map((l) => <option key={l.lessonId} value={l.lessonId}>{l.lessonTitle}</option>)}
            </select>
          </div>
        )}
      </div>
      {lessons.map((lesson) => (
        <div key={lesson.lessonId} className="border-b border-ms-line last:border-b-0">
          <div className="bg-ms-canvas/50 px-4 py-3 sm:px-5"><LessonHeader lesson={lesson} /></div>
          <ExerciseTable lesson={lesson} />
          <ExerciseList lesson={lesson} />
        </div>
      ))}
    </section>
  );
}

/* ─── Espace de travail complet ────────────────────────────────────── */

export interface ClassOption { id: string; name: string; studentIds: string[] }

export default function ProgressWorkspace({ insights, error, classes }: {
  insights: TeacherInsights | null; error: string | null; classes: ClassOption[];
}) {
  // `/teacher?classe=<id>#progression` (depuis l'espace d'une classe) préselectionne
  // la classe ; le filtre reste modifiable à la main ensuite.
  const params = useSearchParams();
  const requestedClass = params.get("classe");
  const [classId, setClassId] = useState(requestedClass ?? "all");
  // Si l'URL change pendant que le composant est monté, on suit la nouvelle classe demandée.
  const [seenRequest, setSeenRequest] = useState(requestedClass);
  if (requestedClass !== seenRequest) {
    setSeenRequest(requestedClass);
    if (requestedClass) setClassId(requestedClass);
  }
  const [query, setQuery] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const ids = useId();

  // Une classe inconnue dans l'URL (supprimée, ou pas encore chargée) ne filtre rien.
  const activeClass = classes.find((c) => c.id === classId) ?? null;
  const effectiveClassId = activeClass ? classId : "all";

  const students = useMemo(() => {
    if (!insights) return [];
    const members = activeClass ? new Set(activeClass.studentIds) : null;
    const q = query.trim().toLocaleLowerCase("fr");
    return insights.students.filter((st) =>
      (!members || members.has(st.userId)) &&
      (!q || st.userName.toLocaleLowerCase("fr").includes(q)) &&
      (!reviewOnly || st.toReview > 0));
  }, [insights, activeClass, query, reviewOnly]);

  const filtered = effectiveClassId !== "all" || query.trim() !== "" || reviewOnly;
  // Par défaut, le premier élève de la liste (le plus récemment actif), comme avant.
  const selected = students.find((s) => s.userId === selectedId) ?? students[0] ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    // Petits écrans : le détail est sous la liste ; on y amène la personne et le focus.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        detailHeading.current?.scrollIntoView({ block: "start" });
        detailHeading.current?.focus({ preventScroll: true });
      }
    });
  };
  const clearFilters = () => { setClassId("all"); setQuery(""); setReviewOnly(false); };

  return (
    <section aria-labelledby={`${ids}-h`} id="progression" className="scroll-mt-24 space-y-4">
      <SectionHeader
        id={`${ids}-h`}
        title="Progression des élèves"
        description={<>Ordre : activité la plus récente d&apos;abord. « À revoir » compte les exercices non réussis du premier coup lors de leur dernière tentative.</>}
      />

      {error && <InlineNotice tone="error">Impossible de charger la progression : {error}</InlineNotice>}

      {!error && (
        <div ref={listTop} className="ms-panel overflow-hidden">
          {insights && insights.students.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 border-b border-ms-line px-4 py-4 sm:px-5">
              {classes.length > 0 && (
                <div className="flex w-full flex-col gap-2 sm:w-56">
                  <label htmlFor={`${ids}-class`} className="text-sm font-semibold">Classe</label>
                  <select id={`${ids}-class`} value={effectiveClassId} onChange={(e) => setClassId(e.target.value)} className="ms-field">
                    <option value="all">Toutes les classes</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex w-full flex-col gap-2 sm:w-64">
                <label htmlFor={`${ids}-q`} className="text-sm font-semibold">Rechercher un élève</label>
                <div className="relative">
                  <Search size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ms-muted" />
                  <input id={`${ids}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="ms-field pl-10" autoComplete="off" />
                </div>
              </div>
              <Button aria-pressed={reviewOnly} variant={reviewOnly ? "primary" : "secondary"} onClick={() => setReviewOnly((v) => !v)}>
                <RotateCcw size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> À revoir
              </Button>
              {filtered && <Button variant="quiet" onClick={clearFilters}>Effacer les filtres</Button>}
            </div>
          )}

          {/* Même hauteur qu'un tableau de six élèves : la page ne saute pas quand les données arrivent. */}
          {insights === null && <div className="min-h-[26rem]"><SkeletonRows rows={8} label="Chargement de la progression" /></div>}
          {insights && insights.students.length === 0 && (
            <EmptyState title="Les progrès apparaîtront ici" text="Les premières activités réalisées par vos élèves alimenteront ce suivi." />
          )}
          {insights && insights.students.length > 0 && students.length === 0 && (
            <EmptyState title="Aucun élève ne correspond à ces filtres." action={<Button onClick={clearFilters}>Effacer les filtres</Button>} />
          )}
          {students.length > 0 && (
            <>
              <p className="sr-only" role="status">{plural(students.length, "élève")}</p>
              <SummaryTable students={students} selectedId={selected?.userId ?? null} onSelect={select} />
              <SummaryList students={students} onSelect={select} />
            </>
          )}
        </div>
      )}

      {selected && (
        <StudentDetail
          key={selected.userId}
          student={selected}
          headingRef={detailHeading}
          onBack={() => listTop.current?.scrollIntoView({ block: "start" })}
        />
      )}
    </section>
  );
}
