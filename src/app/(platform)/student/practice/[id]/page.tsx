"use client";
/**
 * Révision personnalisée d'une leçon.
 *
 * POST /api/practice construit une série ciblée sur les exercices que
 * l'élève a ratés (rejoués tels quels par défaut, ou générés par l'agent en
 * mode claude) ; ils sont joués ici avec les mêmes rendus que la leçon, et
 * leurs événements se journalisent sous la leçon d'origine.
 */
import { useState, use, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, ArrowLeft, Check, CircleSlash, Hourglass, RefreshCw, RotateCcw } from "lucide-react";
import { fetchLessons, type ApiLesson } from "@/lib/api/lessons";
import { fetchLatestPracticeSet, generatePractice, fetchPracticeSummary } from "@/lib/api/practice";
import { flushExerciseEvents } from "@/lib/api/events";
import type { PracticeSet } from "@/lib/practice";
import {
  QuizRenderer, WordOrderRenderer,
  type QuizExercise, type WordOrderExercise,
} from "@/components/lesson/ExerciseRenderers";
import dynamic from "next/dynamic";
import { NEXT_LETTER_EXERCISE_DELAY_MS } from "@/lib/letterExercises";

const LetterExercise = dynamic(() => import("@/components/lesson/LetterExercise").then((m) => m.LetterExercise), {
  loading: () => <div className="ms-skeleton h-72 w-full rounded-3xl" aria-busy="true" aria-label="Chargement de l'exercice" />,
});
import { STUDENT_ICON } from "@/components/student/StudentShell";
import { ACCENT_PASTEL_HEX, accentAt, accentButton, type Accent } from "@/components/student/accents";

type Phase =
  | { kind: "loading" }
  | { kind: "intro" }                       // aucune série : proposer d'en préparer une
  | { kind: "generating" }
  | { kind: "nothing" }                     // rien de raté sur cette leçon
  | { kind: "empty" }                       // le modèle n'a rien produit d'exploitable
  | { kind: "error"; message: string }
  | { kind: "playing"; set: PracticeSet }
  | { kind: "done"; set: PracticeSet };

/** « Exercice N sur M » : même repère que la page de leçon. */
function ExerciseProgress({ index, total, accent }: { index: number; total: number; accent: Accent }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: accent.soft }} aria-hidden="true">
        <div className="h-full rounded-full transition-[width] duration-[240ms]" style={{ background: accent.pastel, width: `${(index / total) * 100}%` }} />
      </div>
      <span className="shrink-0 text-base font-bold tabular-nums text-ms-muted">Exercice {index + 1} sur {total}</span>
    </div>
  );
}

/** Tuile d'icône calme, à la place des anciens émojis d'état. */
function StateTile({ icon: Icon, accent, tone = "accent" }: { icon: LucideIcon; accent: Accent; tone?: "accent" | "error" }) {
  return (
    <span
      className={`flex h-24 w-24 items-center justify-center rounded-[1.75rem] ${tone === "error" ? "bg-ms-danger-soft text-ms-danger" : ""}`}
      style={tone === "error" ? undefined : { background: accent.soft, color: "var(--ms-ink)" }}
    >
      <Icon size={48} strokeWidth={tone === "error" ? 1.75 : 2} aria-hidden="true" />
    </span>
  );
}

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lesson, setLesson] = useState<ApiLesson | null | "loading">("loading");
  // Même rotation que l'accueil élève et la page de leçon : la leçon garde sa couleur.
  const [accent, setAccent] = useState<Accent>(accentAt(0));
  const [phase,  setPhase]  = useState<Phase>({ kind: "loading" });
  const [index,  setIndex]  = useState(0);
  // Nombre d'exercices ratés sur la leçon (null = inconnu), pour l'écran d'accueil.
  const [failed, setFailed] = useState<number | null>(null);

  const generate = useCallback(async () => {
    setPhase({ kind: "generating" });
    try {
      // Les réponses de la série précédente doivent être enregistrées avant
      // que le serveur ne calcule ce qui reste à revoir.
      await flushExerciseEvents();
      const result = await generatePractice(id);
      if (result.status === "created") { setIndex(0); setPhase({ kind: "playing", set: result.set }); }
      else if (result.status === "nothing_to_review") setPhase({ kind: "nothing" });
      else setPhase({ kind: "empty" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Erreur inattendue" });
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      const all = await fetchLessons().catch(() => [] as ApiLesson[]);
      const idx = all.findIndex((l) => l.id === id);
      setLesson(idx >= 0 ? all[idx] : null);
      if (idx >= 0) setAccent(accentAt(idx));
      if (idx < 0) { setPhase({ kind: "error", message: "Leçon introuvable" }); return; }
      const [set, summary] = await Promise.all([
        fetchLatestPracticeSet(id).catch(() => null),
        fetchPracticeSummary().catch(() => []),
      ]);
      const toReview = summary.find((s) => s.lessonId === id)?.toReview ?? 0;
      setFailed(toReview);
      // Tout a été réussi du premier coup : rien à rejouer.
      if (toReview === 0) setPhase({ kind: "nothing" });
      // Déjà révisé : nouvelle série avec les seuls exercices encore ratés,
      // plutôt que l'ancienne série entière.
      else if (set) void generate();
      else setPhase({ kind: "intro" });
    })();
  }, [id, generate]);

  const title = lesson && lesson !== "loading" ? lesson.title : "";
  // Les exercices attendent une couleur littérale qui porte du texte blanc : la teinte profonde.
  const color = ACCENT_PASTEL_HEX[accent.name];

  const nav = (
    <div className="sticky top-0 z-40 border-b border-ms-line bg-ms-surface">
      <div className="mx-auto flex min-h-20 max-w-[66rem] items-center gap-3 px-4 sm:px-6">
        <Link href="/student" data-variant="quiet" className="ms-button -ms-3 shrink-0" style={{ color: "var(--ms-ink)" }}>
          <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Mes leçons
        </Link>
        <p className="min-w-0 flex-1 truncate text-end text-lg font-extrabold">
          <span className="text-ms-muted">Révision</span>{title && <> · {title}</>}
        </p>
      </div>
      <div className="h-1" style={{ background: accent.pastel }} aria-hidden="true" />
    </div>
  );

  // `wash` : le lavis pastel, seulement sur les écrans de fin (un accomplissement calme).
  const card = (children: ReactNode, opts: { busy?: boolean; wash?: boolean } = {}) => (
    <div data-ms-app="" data-ms-area="student" className="flex min-h-dvh flex-col bg-ms-canvas">
      {nav}
      <main className={`flex flex-1 items-center justify-center px-4 py-10 ${opts.wash ? "ms-welcome-wash" : ""}`}>
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center" aria-busy={opts.busy || undefined}>
          {children}
        </div>
      </main>
    </div>
  );

  if (phase.kind === "loading" || lesson === "loading") {
    return (
      <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas" aria-busy="true" aria-label="Chargement de la révision">
        <div className="h-[5.25rem] border-b border-ms-line bg-ms-surface" />
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16">
          <div className="ms-skeleton h-24 w-24 rounded-[1.75rem]" />
          <div className="ms-skeleton h-8 w-64" />
          <div className="ms-skeleton h-5 w-full" />
          <div className="ms-skeleton h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    return card(<>
      <StateTile icon={AlertCircle} accent={accent} tone="error" />
      <div role="alert">
        <h1 className="text-[2rem] font-extrabold leading-10">La révision n&apos;a pas pu démarrer</h1>
        <p className="mt-2 text-ms-muted">{phase.message}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button type="button" onClick={generate} data-variant="secondary" className="ms-button flex-1">
          <RefreshCw size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Réessayer
        </button>
        <Link href="/student" data-variant="primary" className="ms-button flex-1" style={accentButton(accent)}>
          Retour à mes leçons
        </Link>
      </div>
    </>);
  }

  if (phase.kind === "intro") {
    return card(<>
      <StateTile icon={RotateCcw} accent={accent} />
      <div>
        <h1 className="text-[2rem] font-extrabold leading-10">Ta révision</h1>
        <p className="mt-2 text-ms-muted">
          {failed !== null && failed > 0 ? (
            <>Dans <strong className="text-ms-ink">{title}</strong>, {failed} exercice{failed > 1 ? "s sont" : " est"} à revoir. Tu peux {failed > 1 ? "les" : "le"} rejouer maintenant.</>
          ) : (
            <>Les exercices à revoir dans <strong className="text-ms-ink">{title}</strong> sont rassemblés pour que tu les rejoues.</>
          )}
        </p>
      </div>
      <button type="button" onClick={generate} data-variant="primary" className="ms-button w-full" style={accentButton(accent)}>
        Commencer la révision
      </button>
    </>);
  }

  if (phase.kind === "generating") {
    return card(<>
      <StateTile icon={Hourglass} accent={accent} />
      <div aria-live="polite">
        <h1 className="text-[2rem] font-extrabold leading-10">Préparation des exercices…</h1>
        <p className="mt-2 text-ms-muted">Un instant.</p>
      </div>
    </>, { busy: true });
  }

  if (phase.kind === "nothing") {
    return card(<>
      <StateTile icon={Check} accent={accent} />
      <div>
        <h1 className="text-[2rem] font-extrabold leading-10">Rien à revoir</h1>
        <p className="mt-2 text-ms-muted">Tu as réussi tous les exercices de cette leçon du premier coup.</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Link href={`/student/lesson/${id}`} data-variant="secondary" className="ms-button flex-1">
          Rejouer la leçon
        </Link>
        <Link href="/student" data-variant="primary" className="ms-button flex-1" style={accentButton(accent)}>
          Choisir une autre leçon
        </Link>
      </div>
    </>, { wash: true });
  }

  if (phase.kind === "empty") {
    return card(<>
      <StateTile icon={CircleSlash} accent={accent} />
      <div>
        <h1 className="text-[2rem] font-extrabold leading-10">Pas d&apos;exercice cette fois</h1>
        <p className="mt-2 text-ms-muted">Aucun exercice n&apos;a pu être préparé. Tu peux rejouer la leçon ou réessayer plus tard.</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Link href={`/student/lesson/${id}`} data-variant="secondary" className="ms-button flex-1">
          Rejouer la leçon
        </Link>
        <Link href="/student" data-variant="primary" className="ms-button flex-1" style={accentButton(accent)}>
          Retour à mes leçons
        </Link>
      </div>
    </>);
  }

  if (phase.kind === "done") {
    const count = phase.set.blocks.length;
    return card(<>
      <StateTile icon={Check} accent={accent} />
      <div>
        <h1 className="text-[2rem] font-extrabold leading-10">Tu as terminé</h1>
        <p className="mt-1 text-xl font-semibold text-ms-muted [overflow-wrap:anywhere]">{title}</p>
      </div>
      {/* Ce que l'élève vient de faire, en vrai : le nombre d'exercices rejoués. */}
      <p className="rounded-2xl px-5 py-3 text-lg font-bold tabular-nums" style={{ background: accent.soft, color: "var(--ms-ink)" }}>
        {count} exercice{count > 1 ? "s" : ""} rejoué{count > 1 ? "s" : ""}
      </p>
      <p className="text-ms-muted">Tu peux revenir quand tu veux.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button type="button" onClick={generate} data-variant="secondary" className="ms-button flex-1">
          <RefreshCw size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Encore une fois
        </button>
        <Link href="/student" data-variant="primary" className="ms-button flex-1" style={accentButton(accent)}>
          Choisir une autre leçon
        </Link>
      </div>
    </>, { wash: true });
  }

  // phase.kind === "playing"
  const { set } = phase;
  const block = set.blocks[index];
  const advance = () => {
    if (index < set.blocks.length - 1) setIndex(index + 1);
    else {
      setPhase({ kind: "done", set });
      // Envoie les réussites tout de suite : le tableau de bord les relira.
      void flushExerciseEvents();
    }
  };
  const ex = block.exercise;

  return (
    <div data-ms-app="" data-ms-area="student" className="flex min-h-dvh flex-col bg-ms-canvas">
      {nav}
      <main className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <ExerciseProgress index={index} total={set.blocks.length} accent={accent} />

        <div className="flex flex-1 flex-col justify-center">
          {ex.type === "quiz" && (
            <QuizRenderer
              key={block.id}
              ex={ex as QuizExercise}
              color={color}
              onNext={advance}
              idx={index}
              total={set.blocks.length}
              lessonId={set.lessonId}
              blockId={block.id}
            />
          )}

          {ex.type === "wordorder" && (
            <WordOrderRenderer
              key={block.id}
              ex={ex as WordOrderExercise}
              color={color}
              onNext={advance}
              lessonId={set.lessonId}
              blockId={block.id}
            />
          )}

          {ex.type === "letterGame" && (
            <LetterExercise
              key={block.id}
              slide={ex.slide}
              color={color}
              accent={accent}
              lessonId={set.lessonId}
              eventId={block.id}
              onSolved={() => setTimeout(advance, NEXT_LETTER_EXERCISE_DELAY_MS)}
            />
          )}

          {ex.type !== "quiz" && ex.type !== "wordorder" && ex.type !== "letterGame" && (
            <div className="flex justify-center">
              <button type="button" onClick={advance} data-variant="primary" className="ms-button min-w-48" style={accentButton(accent)}>
                Continuer
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
