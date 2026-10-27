"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Radio, RotateCcw } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { fetchLessons, type ApiLesson } from "@/lib/api/lessons";
import { fetchPracticeSummary } from "@/lib/api/practice";
import { fetchExerciseEvents } from "@/lib/api/events";
import { fetchLiveClasses } from "@/lib/api/classes";
import type { LiveClass } from "@/lib/classes";
import type { LessonReviewSummary } from "@/lib/weakSpots";
import { countActivities, lessonCover } from "@/lib/lessonActivities";
import { LetterGlyph } from "@/components/present/LetterTracing";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LessonImage } from "@/components/platform/LessonImage";
import StudentShell, { STUDENT_ICON } from "@/components/student/StudentShell";
import { accentAt, type Accent } from "@/components/student/accents";

/** Le cours en direct est revérifié de temps en temps, sans recharger la page. */
const LIVE_POLL_MS = 15000;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/**
 * Ce que l'élève a réellement fait sur une leçon, d'après ses propres
 * événements d'exercice : rien (« Commencer »), ou déjà joué (« Rejouer »),
 * avec la date du dernier passage. Aucune position de reprise n'est
 * enregistrée : « Continuer » n'est donc jamais proposé.
 */
interface Played { lastAt: string }

/**
 * La trace de l'élève, tirée de ses événements d'exercice : les lettres dont
 * il a réussi un jeu (l'identifiant d'un jeu de lettres contient le numéro
 * de la lettre, voir letterGameId), les exercices réussis, les leçons jouées.
 * Rien n'est interprété : pas de niveau, pas de maîtrise, pas de classement.
 */
interface Trace { letterIds: number[]; successes: number; lessons: number }

const GAME_ID = /^[^:]+:(pickSound|findLetter|findInWord|completeWord|write):(\d+)/;

function traceFrom(rows: { lesson_id: string; block_id: string; event_type: string; correct: boolean | null }[]): Trace {
  const letters = new Set<number>();
  const lessons = new Set<string>();
  let successes = 0;
  for (const r of rows) {
    lessons.add(r.lesson_id);
    if (r.event_type !== "complete" || r.correct === false) continue;
    successes += 1;
    const m = GAME_ID.exec(r.block_id);
    if (m) letters.add(Number(m[2]));
  }
  return { letterIds: [...letters].sort((a, b) => a - b), successes, lessons: lessons.size };
}

/** Ce que l'enfant a déjà fait, en objets : ses lettres, ses réussites. Absent tant qu'il n'a rien fait. */
function Atelier({ trace }: { trace: Trace }) {
  if (trace.successes === 0 && trace.letterIds.length === 0) return null;
  const letters = trace.letterIds.map((id) => ARABIC_ALPHABET.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);
  return (
    <section aria-labelledby="atelier" className="flex flex-col gap-4 rounded-3xl border border-ms-line bg-ms-surface p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
      <div className="min-w-0 sm:w-56 sm:shrink-0">
        <h2 id="atelier" className="text-2xl font-extrabold leading-8">Ton atelier</h2>
        <p className="mt-1 text-ms-muted tabular-nums">
          {plural(trace.lessons, "leçon jouée", "leçons jouées")} · {plural(trace.successes, "exercice réussi", "exercices réussis")}
        </p>
      </div>
      {letters.length > 0 && (
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">{letters.length > 1 ? "Les lettres que tu as retrouvées" : "La lettre que tu as retrouvée"}</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Lettres réussies">
            {letters.map((l) => (
              <li key={l.id} lang="ar" dir="rtl" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ms-sage-soft text-ms-sage-ink" title={l.nameTranslit}>
                <LetterGlyph char={l.isolated} className="h-11 w-11" />
                <span className="sr-only">{l.nameTranslit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Cover({ lesson, accent, className, priority }: { lesson: ApiLesson; accent: Accent; className: string; priority: boolean }) {
  const cover = lessonCover(lesson.blocks);
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} style={{ background: accent.soft }}>
      {cover.kind === "image" && (
        <LessonImage src={cover.url} alt="" priority={priority} className="object-cover"
          sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 7rem" />
      )}
      {cover.kind === "letter" && (
        <span lang="ar" dir="rtl" style={{ color: accent.deep }} className="flex h-full w-full items-center justify-center p-3">
          <LetterGlyph char={cover.letter.isolated} className="h-full max-h-36 w-auto" />
        </span>
      )}
      {cover.kind === "none" && <BookOpen size={48} strokeWidth={1.5} aria-hidden="true" style={{ color: accent.deep }} />}
    </div>
  );
}

/**
 * Une leçon : sa couverture, son titre, son état réel et une action principale
 * (« Commencer » ou « Rejouer ») qui couvre toute la carte ; « Réviser »,
 * quand il y a des exercices à revoir, est une seconde action distincte.
 */
function LessonTile({ lesson, accent, played, toReview, priority = false }: {
  lesson: ApiLesson; accent: Accent; played: Played | null; toReview: number; priority?: boolean;
}) {
  const activities = countActivities(lesson.blocks);
  const action = played ? "Rejouer" : "Commencer";
  return (
    <li className="relative min-w-0">
      {/* Toute la carte est le lien principal ; « Réviser » est un second lien, posé par-dessus à droite. */}
      <Link
        href={`/student/lesson/${lesson.id}`}
        aria-label={`${lesson.title} : ${action.toLowerCase()}`}
        className="group flex h-full min-h-28 overflow-hidden rounded-3xl border border-ms-line bg-ms-surface shadow-[var(--ms-shadow-student)] transition-[border-color,transform] duration-[140ms] hover:border-ms-control active:scale-[0.99] sm:flex-col"
      >
        <Cover lesson={lesson} accent={accent} priority={priority} className="w-28 shrink-0 sm:aspect-[4/3] sm:w-full" />
        <span className={`flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5 ${toReview > 0 ? "pb-[4.5rem] sm:pb-5" : ""}`}>
          <span className="text-xl font-extrabold leading-7 [overflow-wrap:anywhere] sm:text-2xl sm:leading-8">{lesson.title}</span>
          <span className="text-base text-ms-muted tabular-nums">
            {plural(activities, "activité")}
            {played && <> · déjà jouée</>}
          </span>
          <span className="mt-auto flex items-center gap-4 pt-1">
            <span className="inline-flex min-h-12 items-center gap-1 text-lg font-bold text-ms-primary">
              {action} <ChevronRight size={24} strokeWidth={2} aria-hidden="true" className="transition-transform duration-[140ms] group-hover:translate-x-0.5" />
            </span>
            {/* Place réservée au lien « Réviser » (à droite dès 640 px ; en dessous sur téléphone). */}
            {toReview > 0 && <span aria-hidden="true" className="ms-auto hidden w-36 sm:inline-block" />}
          </span>
        </span>
      </Link>
      {toReview > 0 && (
        <Link href={`/student/practice/${lesson.id}`}
          className="absolute bottom-2 left-[7.75rem] z-10 inline-flex min-h-16 min-w-16 items-center gap-1.5 rounded-2xl px-3 font-bold text-ms-blush-ink hover:bg-ms-blush-soft sm:bottom-4 sm:left-auto sm:right-4">
          <RotateCcw size={24} strokeWidth={1.75} aria-hidden="true" /> Réviser ({toReview})
        </Link>
      )}
    </li>
  );
}

/** En-tête d'arrivée : une ligne quand rien ne se passe ; le cours en direct domine quand il est ouvert. */
function Arrival({ firstName, lives }: { firstName?: string; lives: LiveClass[] | null }) {
  const open = !!lives && lives.length > 0;
  return (
    <header className={`ms-welcome-wash -mx-4 flex flex-col gap-4 border-y border-ms-line px-4 sm:mx-0 sm:rounded-3xl sm:border sm:px-8 ${open ? "py-6 sm:py-8" : "py-5 sm:py-6"}`}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[2rem] font-extrabold leading-10 tracking-[-0.02em]">Bonjour{firstName ? `, ${firstName}` : ""}</h1>
          {!open && <p className="mt-1 text-xl font-semibold leading-7 text-ms-muted">Choisis une leçon.</p>}
        </div>
        <span aria-hidden="true" className="hidden shrink-0 items-end gap-2.5 sm:flex">
          <span className="h-10 w-10 rounded-xl border-[3px] border-ms-blush bg-ms-blush-soft" />
          <span className="h-16 w-10 rounded-xl border-[3px] border-ms-slate bg-ms-slate-soft" />
          <span className="h-[5.5rem] w-10 rounded-xl border-[3px] border-ms-sage bg-ms-sage-soft" />
        </span>
      </div>

      {open ? (
        <section aria-labelledby="direct" className="flex flex-col gap-4 rounded-3xl border border-ms-line bg-ms-surface p-5 shadow-[var(--ms-shadow-student)] sm:flex-row sm:items-center sm:p-6">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ms-slate-soft text-ms-slate-ink">
            <Radio size={32} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="direct" className="text-2xl font-extrabold leading-8">Le cours a commencé</h2>
            <p className="text-ms-muted">{lives!.map((l) => (l.teacherName ? `${l.name}, avec ${l.teacherName}` : l.name)).join(" · ")}</p>
          </div>
          <Link href="/student/live" data-variant="primary" className="ms-button">Rejoindre le cours</Link>
        </section>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ms-muted">
          <Radio size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" className="text-ms-slate" />
          {lives === null ? "Cours en direct…" : "Pas de cours en direct en ce moment."}
          <Link href="/student/live" className="inline-flex min-h-16 items-center font-bold text-ms-slate-ink underline-offset-4 hover:underline">
            Salle du cours en direct
          </Link>
        </p>
      )}
    </header>
  );
}

export default function StudentPage() {
  const user = useAuthStore((s) => s.user);
  const [lessons, setLessons] = useState<ApiLesson[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Leçons où l'élève a raté des exercices : la plateforme lui propose une
  // révision ciblée (voir /api/practice/summary). Vide tant que rien n'est raté.
  const [toReview, setToReview] = useState<LessonReviewSummary[]>([]);
  // Leçons déjà jouées, d'après les événements d'exercice de l'élève.
  const [played, setPlayed] = useState<Map<string, Played>>(new Map());
  const [trace, setTrace] = useState<Trace>({ letterIds: [], successes: 0, lessons: 0 });
  const [lives, setLives] = useState<LiveClass[] | null>(null);

  const load = useCallback(() => {
    fetchLessons().then((l) => { setLessons(l); setFailed(false); }).catch(() => { setLessons([]); setFailed(true); });
    fetchPracticeSummary().then(setToReview).catch(() => setToReview([]));
    fetchExerciseEvents({ limit: 2000 }).then((rows) => {
      const map = new Map<string, Played>();
      for (const r of rows) {
        const prev = map.get(r.lesson_id);
        if (!prev || r.created_at > prev.lastAt) map.set(r.lesson_id, { lastAt: r.created_at });
      }
      setPlayed(map);
      setTrace(traceFrom(rows));
    }).catch(() => setPlayed(new Map()));
  }, []);

  useEffect(load, [load]);

  const retry = () => { setFailed(false); setLessons(null); load(); };

  useEffect(() => {
    let active = true;
    const check = () => fetchLiveClasses().then((l) => { if (active) setLives(l); }).catch(() => { if (active) setLives((prev) => prev ?? []); });
    void check();
    const timer = setInterval(check, LIVE_POLL_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const reviewByLesson = new Map(toReview.map((s) => [s.lessonId, s.toReview]));
  const indexOf = new Map((lessons ?? []).map((l, i) => [l.id, i]));
  const reviewCount = (lessons ?? []).filter((l) => (reviewByLesson.get(l.id) ?? 0) > 0).length;
  const firstName = user?.name?.split(" ")[0];

  return (
    <StudentShell>
      <div className="flex flex-col gap-8 sm:gap-10">
        <Arrival firstName={firstName} lives={lives} />
        <Atelier trace={trace} />

        <section aria-labelledby="mes-lecons" aria-busy={lessons === null} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="mes-lecons" className="text-2xl font-extrabold leading-8">Mes leçons</h2>
            {reviewCount > 0 && (
              <p className="text-ms-blush-ink">
                {reviewCount > 1 ? `${reviewCount} leçons ont` : "Une leçon a"} des exercices à revoir.
              </p>
            )}
          </div>

          {lessons === null && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Chargement des leçons">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex min-h-28 overflow-hidden rounded-3xl border border-ms-line bg-ms-surface sm:flex-col">
                  <div className="ms-skeleton w-28 shrink-0 rounded-none sm:aspect-[4/3] sm:w-full" />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="ms-skeleton h-6 w-2/3" />
                    <div className="ms-skeleton h-4 w-1/3" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {failed && (
            <div role="alert" className="flex flex-col gap-4 rounded-3xl border border-ms-danger bg-ms-danger-soft p-5 text-ms-danger sm:flex-row sm:items-center">
              <p className="flex-1 font-semibold">Tes leçons n&apos;ont pas pu être chargées.</p>
              <button type="button" onClick={retry} data-variant="secondary" className="ms-button">Réessayer</button>
            </div>
          )}

          {lessons && !failed && lessons.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-ms-line bg-ms-surface px-6 py-10 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-ms-sage-soft text-ms-sage-ink">
                <BookOpen size={36} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <p className="text-xl font-extrabold">Tes leçons apparaîtront ici.</p>
              <p className="max-w-[40ch] text-ms-muted">Ton enseignant n&apos;a pas encore proposé de leçon à ta classe.</p>
            </div>
          )}

          {lessons && lessons.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((lesson, i) => (
                <LessonTile key={lesson.id} lesson={lesson}
                  accent={accentAt(indexOf.get(lesson.id) ?? 0)}
                  played={played.get(lesson.id) ?? null}
                  toReview={reviewByLesson.get(lesson.id) ?? 0}
                  priority={i < 3} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
