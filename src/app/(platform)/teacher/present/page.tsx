"use client";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { BookOpen, Check, ChevronRight, Play } from "lucide-react";
import { fetchLessons } from "@/lib/api/lessons";
import { type Slide } from "@/lib/presentation";
import type { SavedDeck } from "@/lib/liveDeck";

import type { ClassRow } from "@/lib/classes";
import { fetchTeacherClasses, startLive, stopLive } from "@/lib/api/classes";

import TeacherShell from "@/components/teacher/TeacherShell";
import { useTeacherSession } from "@/components/teacher/useTeacherSession";
import { Button, ButtonLink, EmptyState, ICON_STROKE, InlineNotice, StatusPill } from "@/components/platform/ui";

type RuleKind = "beginner" | "advanced" | "vocab";

/** Règles de chaque écran, rappelées à l'enseignant avant la séance, pour le mode qu'il a choisi. */
const GAME_RULES: { kind: RuleKind; mode: string; games: { name: string; rule: string }[] }[] = [
  {
    kind: "beginner",
    mode: "Lettres — niveau débutant",
    games: [
      { name: "Tracé de la lettre", rule: "La lettre s'écrit seule à l'écran, trait après trait. Vous dites son nom et son son ; le bouton « Retracer la lettre » rejoue le tracé." },
      { name: "Écrire au doigt", rule: "L'élève repasse la lettre sur son pointillé, au doigt ou à la souris. Le départ, le sens et l'ordre des traits sont vérifiés ; un trait raté s'efface et se recommence. La lettre terminée compte comme une bonne réponse." },
      { name: "Où est la lettre ?", rule: "Trois cartes. Vous annoncez la lettre à retrouver (elle est rappelée au-dessus de l'écran partagé) ; l'élève touche la bonne carte. Une erreur grise la carte, il réessaie." },
      { name: "Quel est le son ?", rule: "La lettre est affichée ; trois haut-parleurs identiques proposent trois sons. L'élève écoute chacun, puis coche celui de la lettre. Le son attendu est rappelé dans la barre de commandes." },
    ],
  },
  {
    kind: "advanced",
    mode: "Lettres — niveau avancé",
    games: [
      { name: "Les trois formes", rule: "Début, milieu et fin de mot se révèlent une à une, chacune avec un mot où la lettre est colorée. Vous lisez le mot ; son sens est rappelé dans la barre de commandes." },
      { name: "Quelle est la lettre colorée ?", rule: "Un mot est affiché, une lettre en couleur. L'élève choisit cette lettre parmi trois cartes de couleur neutre." },
      { name: "Compléter le mot", rule: "Un mot avec un trou à la place de la lettre du jour. L'élève choisit, parmi ses formes début / milieu / fin, celle qui complète le mot." },
      { name: "Écrire les formes liées", rule: "Comme « Écrire au doigt », mais pour chaque forme de la lettre. La forme à écrire est rappelée dans la barre de commandes." },
    ],
  },
  {
    kind: "vocab",
    mode: "Leçon de vocabulaire",
    games: [
      { name: "Cartes", rule: "Une image par carte. « Suivant » la retourne pour montrer le mot, s'il est écrit ; sinon vous le dites." },
      { name: "Animations", rule: "Après la carte, l'animation du mot s'il en a (on coupe la pomme, on presse l'orange, on épluche la banane, on mange la fraise, on lave le raisin). Elle tourne en boucle, sans son : vous racontez. Ce qu'elle montre est rappelé dans la barre de commandes." },
      { name: "Devinette floutée", rule: "L'image apparaît très floue et se précise en trois étapes ; les élèves devinent à voix haute. Rien à cliquer : la dernière étape révèle l'image et le mot." },
      { name: "Qu'est-ce qui a disparu ?", rule: "Quatre images à mémoriser. « Suivant » en fait disparaître une : les élèves disent laquelle. « Suivant » encore la fait réapparaître." },
      { name: "Quelle animation ?", rule: "En dernier, dès deux mots animés : deux ou trois animations tournent côte à côte. Vous demandez celle qui montre tel geste (la question en arabe est rappelée au-dessus de l'écran partagé) ; l'élève touche la bonne." },
      { name: "Quiz en images", rule: "Sans QCM dans la leçon : un mot écrit et quatre images, l'élève touche la bonne. Ne concerne que les mots écrits." },
      { name: "QCM de la leçon", rule: "Vos quiz à choix multiple, dans l'ordre de la leçon. La question s'affiche si vous l'avez écrite ; sinon, quand l'image de la bonne réponse est connue, elle vous est proposée en arabe (« أَيْنَ … ؟ ») ; sinon vous la posez. L'élève touche la bonne réponse ; elle est rappelée dans la barre de commandes." },
    ],
  },
];

const SESSION_TIPS = [
  "Passez en plein écran, puis partagez la fenêtre dans votre visioconférence.",
  "Les flèches gauche et droite du clavier, ou la barre d'espace, font avancer la présentation. Elles sont sans effet pendant la saisie dans un champ.",
  "Les élèves de la classe voient le cours dans leur espace et le rejoignent d'un clic : ils suivent les écrans, répondent eux-mêmes aux jeux et vous voient en vidéo.",
  "Pendant un jeu, cliquez sur la bonne réponse pour afficher la solution chez tous les élèves.",
  "Les écrans de lettres ne comportent aucun texte français : vous énoncez les consignes. Au jeu « Où est la lettre ? », la lettre à annoncer est rappelée au-dessus de l'écran partagé.",
  "Les QCM affichent la question telle que vous l'avez rédigée ; la bonne réponse est rappelée dans la barre de commandes.",
  "Dans tous les jeux, seul le premier essai de chaque élève compte dans le décompte par réponse ; après une erreur, il peut réessayer jusqu'à trouver.",
];

/** Leçon d'enseignant dont le diaporama est enregistré. */
interface SavedLesson { id: string; title: string; classId: string | null; live: SavedDeck; liveStale: boolean | null }

/** Séance en cours : le diaporama, la leçon, la classe et le salon (tiré au hasard par le serveur). */
interface LiveSessionInfo { deck: Slide[]; lessonTitle: string; classId: string; className: string; room: string }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

// Le lecteur (vidéo WebRTC, diapositives animées) n'est chargé qu'au lancement du cours.
const LivePlayer = dynamic(() => import("@/components/present/LivePlayer").then((m) => m.LivePlayer), {
  ssr: false,
  loading: () => <div data-ms-app="" data-ms-area="teacher" className="min-h-dvh bg-ms-canvas" aria-busy="true" />,
});

export default function TeacherPresentPage() {
  const [session, setSession] = useState<LiveSessionInfo | null>(null);

  // Onglet fermé ou page quittée sans « Terminer le cours » : le cours se termine quand même.
  useEffect(() => {
    if (!session) return;
    const end = () => void stopLive(session.classId, session.room);
    window.addEventListener("pagehide", end);
    return () => window.removeEventListener("pagehide", end);
  }, [session]);

  return session ? (
    <LivePlayer
      deck={session.deck}
      classId={session.classId}
      code={session.room}
      className={session.className}
      lessonTitle={session.lessonTitle}
      onQuit={() => { void stopLive(session.classId, session.room); setSession(null); }}
    />
  ) : (
    // L'écran de lancement lit ?class= et ?lesson= : Suspense, comme Next le demande pour useSearchParams.
    <Suspense fallback={<div data-ms-app="" data-ms-area="teacher" className="min-h-dvh bg-ms-canvas" aria-busy="true" />}>
      <Setup onStart={setSession} />
    </Suspense>
  );
}

/** Parties d'un diaporama enregistré, pour n'en rappeler que les règles utiles. */
function deckKinds(deck: readonly Slide[]): RuleKind[] {
  const kinds: RuleKind[] = [];
  if (deck.some((s) => s.kind === "forms")) kinds.push("advanced");
  else if (deck.some((s) => s.kind === "letter")) kinds.push("beginner");
  if (deck.some((s) => s.kind === "flashcard" || s.kind === "qcm" || s.kind === "quiz")) kinds.push("vocab");
  return kinds;
}

/** Squelette d'une liste de choix, à la forme des cartes attendues. */
function ChoiceSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => <div key={i} className="ms-skeleton h-16" />)}
    </div>
  );
}

/**
 * Carte de choix : un vrai bouton radio, sélection signalée par le contour, le fond et une coche.
 * `badges` : statuts non interactifs, dans la carte ; `footer` : un lien éventuel, hors de l'étiquette
 * (un lien dans un label cocherait aussi le bouton radio).
 */
function ChoiceCard({ name, checked, onChange, title, meta, badges, footer }: {
  name: string; checked: boolean; onChange: () => void; title: string; meta: string; badges?: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className={`relative flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-[140ms] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ms-primary ${
          checked ? "border-ms-primary bg-ms-primary-soft" : "border-ms-line bg-ms-surface hover:border-ms-control"
        }`}
      >
        <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold [overflow-wrap:anywhere]">{title}</span>
          <span className="block text-sm text-ms-muted tabular-nums">{meta}</span>
          {badges && <span className="mt-1.5 flex flex-wrap gap-1.5">{badges}</span>}
        </span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            checked ? "border-ms-primary bg-ms-primary text-ms-on-primary" : "border-ms-control bg-ms-surface"
          }`}
        >
          {checked && <Check size={14} strokeWidth={2.5} />}
        </span>
      </label>
      {footer && <div className="px-1">{footer}</div>}
    </div>
  );
}

function Setup({ onStart }: { onStart: (session: LiveSessionInfo) => void }) {
  const { user, isAdmin, handleLogout } = useTeacherSession();
  // Depuis l'espace d'une classe ou d'une leçon : ?class= et ?lesson= préselectionnent, si l'id existe bien.
  const searchParams = useSearchParams();
  // Diaporamas enregistrés : ceux des leçons dont le diaporama a été créé depuis l'éditeur.
  const [lessons, setLessons] = useState<SavedLesson[] | null>(null);
  const [lessonsError, setLessonsError] = useState(false);
  const [lessonsTry, setLessonsTry] = useState(0);
  const [lessonId, setLessonId] = useState<string | null>(() => searchParams.get("lesson"));
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [classesError, setClassesError] = useState(false);
  const [classesTry, setClassesTry] = useState(0);
  const [classId, setClassId] = useState<string | null>(() => searchParams.get("class"));
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchTeacherClasses()
      .then((data) => { if (active) { setClasses(data.classes); setClassesError(false); } })
      .catch(() => { if (active) { setClasses([]); setClassesError(true); } });
    return () => { active = false; };
  }, [classesTry]);

  useEffect(() => {
    let active = true;
    fetchLessons()
      .then((all) => {
        if (!active) return;
        setLessons(all.flatMap((l) => (l.live ? [{ id: l.id, title: l.title, classId: l.classId, live: l.live, liveStale: l.liveStale }] : [])));
        setLessonsError(false);
      })
      .catch(() => { if (active) { setLessonsError(true); setLessons([]); } });
    return () => { active = false; };
  }, [lessonsTry]);

  // Un id inconnu (paramètre d'adresse périmé) retombe sur le premier choix.
  const cls = classes?.find((c) => c.id === classId) ?? classes?.[0] ?? null;
  // Les leçons proposées à la classe choisie viennent en tête ; les autres gardent leur ordre.
  const ordered = useMemo(() => {
    if (!lessons) return null;
    const ofClass = (l: SavedLesson) => (cls && l.classId === cls.id ? 0 : 1);
    return [...lessons].sort((a, b) => ofClass(a) - ofClass(b));
  }, [lessons, cls]);
  const lesson = ordered?.find((l) => l.id === lessonId) ?? ordered?.[0] ?? null;
  const kinds = lesson ? deckKinds(lesson.live.slides) : [];

  const start = async () => {
    if (!lesson || !cls) return;
    setStarting(true);
    setStartError(null);
    try {
      const { room } = await startLive(cls.id);
      onStart({ deck: lesson.live.slides, lessonTitle: lesson.title, classId: cls.id, className: cls.name, room });
    } catch (e) {
      setStartError((e as Error).message);
      setStarting(false);
    }
  };

  return (
    <TeacherShell name={user?.name || "Enseignant"} isAdmin={isAdmin} onLogout={handleLogout}>
      <div className="mx-auto max-w-[52rem] space-y-6 lg:space-y-8">
        <header className="min-w-0">
          <h1 className="text-[1.75rem] leading-9 lg:text-[2rem] lg:leading-10 font-semibold tracking-[-0.02em]">Cours en direct</h1>
          <p className="mt-1 max-w-[62ch] text-ms-muted">
            Choisissez le diaporama d&apos;une leçon et la classe, puis lancez le cours. Les élèves de la classe le rejoignent depuis leur espace.
          </p>
        </header>

        <section aria-labelledby="choix-lecon" className="ms-panel space-y-4 p-4 sm:p-5">
          <fieldset className="min-w-0 space-y-4">
            <legend id="choix-lecon" className="text-xl leading-7 font-semibold">Diaporama</legend>
            <p id="choix-lecon-aide" className="text-sm text-ms-muted max-w-[62ch]">
              Chaque diaporama est créé depuis l&apos;éditeur de sa leçon : mêmes lettres, mêmes images, dans le même ordre.
              Le cours projette le diaporama ; les élèves, eux, retrouvent la leçon dans leur espace.
            </p>
            {ordered === null ? (
              <ChoiceSkeleton label="Chargement des diaporamas" />
            ) : lessonsError ? (
              <InlineNotice
                tone="error"
                action={<Button variant="secondary" onClick={() => { setLessons(null); setLessonsTry((n) => n + 1); }}>Réessayer</Button>}
              >
                Les leçons n&apos;ont pas pu être chargées. Vérifiez votre connexion.
              </InlineNotice>
            ) : ordered.length === 0 ? (
              <div className="rounded-xl bg-ms-surface-muted">
                <EmptyState
                  title="Aucun diaporama enregistré"
                  text="Ouvrez une leçon dans l'éditeur, puis cliquez sur « Créer le diaporama » dans ses informations."
                  action={<ButtonLink href="/teacher/create" variant="primary">Créer une leçon</ButtonLink>}
                />
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2" aria-describedby="choix-lecon-aide">
                {ordered.map((l) => {
                  const ofClass = !!cls && l.classId === cls.id;
                  const stale = l.liveStale === true;
                  return (
                    <ChoiceCard
                      key={l.id}
                      name="lecon"
                      checked={lesson?.id === l.id}
                      onChange={() => setLessonId(l.id)}
                      title={l.title}
                      meta={plural(l.live.slides.length, "écran")}
                      badges={(ofClass || stale) ? (
                        <>
                          {ofClass && <StatusPill state="info">Leçon de cette classe</StatusPill>}
                          {stale && <StatusPill state="review">Diaporama à mettre à jour</StatusPill>}
                        </>
                      ) : undefined}
                      footer={stale ? (
                        <Link href={`/teacher/create?edit=${l.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-ms-primary underline-offset-4 hover:underline">
                          Mettre à jour dans l&apos;éditeur
                        </Link>
                      ) : undefined}
                    />
                  );
                })}
              </div>
            )}
            {lesson && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ms-muted">
                <span>
                  Diaporama créé le{" "}
                  <time dateTime={lesson.live.createdAt}>
                    {new Date(lesson.live.createdAt).toLocaleString("fr-BE", { dateStyle: "long", timeStyle: "short" })}
                  </time>
                  {lesson.liveStale === true && " ; la leçon a changé depuis"}
                </span>
                <Link href={`/teacher/create?edit=${lesson.id}`} className="inline-flex min-h-11 items-center font-semibold text-ms-primary underline-offset-4 hover:underline">
                  Modifier la leçon
                </Link>
              </p>
            )}
          </fieldset>
        </section>

        <section aria-labelledby="choix-classe" className="ms-panel space-y-4 p-4 sm:p-5">
          <fieldset className="min-w-0 space-y-4">
            <legend id="choix-classe" className="text-xl leading-7 font-semibold">Classe</legend>
            <p id="choix-classe-aide" className="text-sm text-ms-muted max-w-[62ch]">
              Seuls les élèves de la classe choisie voient le cours dans leur espace et peuvent le rejoindre.
            </p>
            {classes === null ? (
              <ChoiceSkeleton label="Chargement des classes" />
            ) : classesError ? (
              <InlineNotice
                tone="error"
                action={<Button variant="secondary" onClick={() => { setClasses(null); setClassesTry((n) => n + 1); }}>Réessayer</Button>}
              >
                Les classes n&apos;ont pas pu être chargées. Vérifiez votre connexion.
              </InlineNotice>
            ) : classes.length === 0 ? (
              <div className="rounded-xl bg-ms-surface-muted">
                <EmptyState
                  title="Votre première classe"
                  text="Créez une classe pour y regrouper vos élèves."
                  action={<ButtonLink href="/teacher/classes" variant="primary">Créer une classe</ButtonLink>}
                />
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2" aria-describedby="choix-classe-aide">
                {classes.map((c) => (
                  <ChoiceCard
                    key={c.id}
                    name="classe"
                    checked={cls?.id === c.id}
                    onChange={() => setClassId(c.id)}
                    title={c.name}
                    meta={plural(c.studentIds.length, "élève")}
                  />
                ))}
              </div>
            )}
          </fieldset>
        </section>

        <div className="space-y-3">
          {startError && <InlineNotice tone="error">{startError}</InlineNotice>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="primary" onClick={() => void start()} disabled={!lesson || !cls || starting} aria-describedby="lancer-aide">
              <Play size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {starting ? "Lancement…" : "Lancer le cours"}
            </Button>
            <p id="lancer-aide" className="min-w-0 text-sm text-ms-muted [overflow-wrap:anywhere]">
              {lesson && cls ? `${lesson.title} · ${cls.name}` : "Choisissez un diaporama et une classe."}
            </p>
          </div>
        </div>

        {/* Mode d'emploi : replié par défaut, la tâche principale reste le lancement. */}
        <details className="ms-panel group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[var(--ms-radius-panel)] px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ms-slate-soft text-ms-slate-ink">
              <BookOpen size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Guide de séance</span>
              <span className="block text-sm text-ms-muted">Conseils et règles des jeux{lesson ? " de ce diaporama" : ""}</span>
            </span>
            <ChevronRight size={20} strokeWidth={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ms-muted transition-transform duration-[140ms] group-open:rotate-90" />
          </summary>
          <div className="space-y-6 border-t border-ms-line px-4 py-5 sm:px-5">
            <section aria-labelledby="guide-conseils">
              <h2 id="guide-conseils" className="font-semibold">Conseils pour la séance</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 marker:text-ms-muted">
                {SESSION_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </section>
            {kinds.length > 0 && (
              <section aria-labelledby="guide-regles" className="space-y-4">
                <h2 id="guide-regles" className="font-semibold">Règles des jeux</h2>
                {kinds.flatMap((kind) => GAME_RULES.filter((group) => group.kind === kind)).map((group) => (
                  <div key={group.mode}>
                    <h3 className="text-[0.8125rem] leading-[1.125rem] font-semibold text-ms-muted">{group.mode}</h3>
                    <dl className="mt-1.5 space-y-2 text-sm leading-6">
                      {group.games.map((game) => (
                        <div key={game.name}>
                          <dt className="font-semibold">{game.name}</dt>
                          <dd className="text-ms-muted">{game.rule}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </section>
            )}
          </div>
        </details>
      </div>
    </TeacherShell>
  );
}
