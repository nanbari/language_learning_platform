"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleStop, Ellipsis, Maximize, Minimize, MicOff, Radio, Users } from "lucide-react";

import { qcmAnswerLabel, stepsFor, teacherInstruction, teacherQuestion, type Slide } from "@/lib/presentation";

import { isGame, summarize, type LiveState } from "@/lib/liveSession";

import { useLiveHost, useLiveLink } from "@/hooks/useLiveSession";
import { useVideoCall } from "@/hooks/useLiveVideo";
import { useAuthStore } from "@/store/authStore";
import { SlideView } from "@/components/present/Slides";
import { CallButtons, SoundUnlock, VideoTile } from "@/components/present/VideoCall";

import { Button, ICON_STROKE, StatusPill } from "@/components/platform/ui";
import { LETTER_POSITIONS } from "@/data/letterWords";

/** Repère pour l'enseignant, dans la barre de commandes ; le nom des lettres n'est jamais écrit, il le dit lui-même. */
function TeacherCue({ slide }: { slide: Slide }) {
  let label: string | null = null;
  let value: string | null = null;
  if (slide.kind === "write" && slide.form) {
    label = "Forme à écrire";
    value = `${{ initial: "début", medial: "milieu", final: "fin" }[slide.form]} du mot`;
  } else if (slide.kind === "video") {
    label = "Animation";
    value = slide.caption;
  } else if (slide.kind === "qcm") {
    label = "Bonne réponse";
    value = qcmAnswerLabel(slide.qcm);
  } else if (slide.kind === "pickSound") {
    label = "Réponse attendue";
    value = `son « ${slide.target.translit} »`;
  } else if (slide.kind === "findInWord" || slide.kind === "completeWord") {
    label = "Sens du mot";
    value = slide.word.french;
  } else if (slide.kind === "forms") {
    label = "Sens des mots";
    value = LETTER_POSITIONS.map((position) => slide.words[position].french).join(" · ");
  }
  if (!label) return null;
  return (
    <p className="text-sm leading-5 [overflow-wrap:anywhere]">
      <span className="text-ms-muted">{label} : </span>
      <span className="font-semibold">{value}</span>
    </p>
  );
}

/** Une touche de raccourci ne doit jamais agir pendant une saisie, ni voler l'espace d'un bouton. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isActivatable(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest("button, a, summary, [role='button']");
}

export function LivePlayer({ deck, classId, code, className, lessonTitle, onQuit }: { deck: Slide[]; classId: string; code: string; className: string; lessonTitle: string; onQuit: () => void }) {
  const [pos, setPos] = useState({ index: 0, step: 0 });
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  /** Petit écran : la colonne des participants se replie en une ligne, pour laisser la scène respirer. */
  const [railOpen, setRailOpen] = useState(false);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const slide = deck[pos.index];
  const revealed = revealedIndex === pos.index;

  const liveState = useMemo<LiveState>(
    () => ({ index: pos.index, total: deck.length, step: pos.step, slide: deck[pos.index], revealed }),
    [deck, pos, revealed],
  );
  const link = useLiveLink(classId, code);
  const { participants, tally, connected } = useLiveHost(classId, code, liveState, link);
  // Une fois la connexion établie, sa perte est une reconnexion (le client Realtime réessaie seul).
  const [everConnected, setEverConnected] = useState(false);
  if (connected && !everConnected) setEverConnected(true);
  const summary = summarize(tally, pos.index);
  const { user } = useAuthStore();
  const call = useVideoCall(classId, code, { id: user?.id ?? `teacher-${code}`, name: user?.name ?? "Enseignant", role: "teacher" }, link);

  const next = useCallback(() => {
    setPos((p) => {
      if (p.step < stepsFor(deck[p.index])) return { index: p.index, step: p.step + 1 };
      if (p.index < deck.length - 1) return { index: p.index + 1, step: 0 };
      return p;
    });
  }, [deck]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p.step > 0) return { index: p.index, step: p.step - 1 };
      if (p.index > 0) return { index: p.index - 1, step: 0 };
      return p;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmEnd || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !isActivatable(e.target))) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, confirmEnd]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const quit = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    onQuit();
  };

  const isFirst = pos.index === 0 && pos.step === 0;
  const isLast = pos.index === deck.length - 1 && pos.step >= stepsFor(slide);
  const question = teacherQuestion(slide);
  const instruction = teacherInstruction(slide);
  const teacherName = user?.name ?? "Enseignant";
  const students = participants.length;

  return (
    <div ref={setRoot} data-ms-app="" data-ms-area="teacher" className="flex min-h-dvh flex-col bg-ms-canvas text-ms-ink select-none">
      {/* Séance : classe, état réel de la connexion, position dans le diaporama */}
      <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-ms-line bg-ms-surface px-4 py-2 sm:px-6">
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-lg leading-6 font-semibold [overflow-wrap:anywhere]">
            Cours en direct <span className="text-ms-muted" aria-hidden="true">·</span><span className="sr-only">, classe</span> {className}
          </h1>
          <p className="truncate text-sm leading-5 text-ms-muted">{lessonTitle}</p>
        </div>
        <p className="order-2 text-sm font-semibold tabular-nums sm:order-3" aria-live="polite">
          Activité {pos.index + 1} sur {deck.length}
        </p>
        <div className="order-3 flex basis-full flex-wrap items-center gap-2 sm:order-2 sm:basis-auto" role="status" aria-live="polite">
          {connected ? (
            <StatusPill state="success" icon={Radio}>Connecté</StatusPill>
          ) : everConnected ? (
            <StatusPill state="review">Connexion perdue, reconnexion…</StatusPill>
          ) : (
            <StatusPill state="info">Connexion…</StatusPill>
          )}
          <span className="inline-flex items-center gap-1.5 text-sm text-ms-muted tabular-nums">
            <Users size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {students} élève{students > 1 ? "s" : ""} connecté{students > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-1">
        {/* Scène partagée : un clic dans le vide révèle l'étape suivante */}
        <main className="flex min-h-[56dvh] min-w-0 flex-col lg:min-h-0">
          {(question || instruction) && (
            <div className="px-4 pt-4 text-center sm:px-6">
              {/* Question à poser à voix haute : l'écran de l'élève ne l'affiche pas */}
              {question && (
                /[؀-ۿ]/.test(question) ? (
                  <p lang="ar" dir="rtl" className="ms-arabic text-[clamp(1.5rem,4.5vmin,2.75rem)] text-ms-ink/80">{question}</p>
                ) : (
                  <p className="text-[clamp(1.25rem,3.6vmin,2.25rem)] leading-tight font-semibold text-ms-ink/80">{question}</p>
                )
              )}
              {/* Consigne du jeu de fin de leçon, pour l'enseignant seulement */}
              {instruction && <p className="mt-1 text-base text-ms-muted">{instruction}</p>}
            </div>
          )}
          <div className="flex flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6 cursor-pointer" onClick={next}>
            <div className="m-auto w-full min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pos.index}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                  className="w-full"
                >
                  <SlideView
                    slide={slide}
                    step={pos.step}
                    game={{
                      revealed,
                      counts: summary.counts,
                      // Écrire la lettre soi-même, en démonstration, ne révèle rien aux élèves.
                      onPick: (_, correct) => { if (correct && slide.kind !== "write") setRevealedIndex(pos.index); },
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Participants et suivi privé : jamais envoyés aux élèves */}
        <aside aria-label="Participants et réponses" className="flex min-w-0 flex-col border-t border-ms-line bg-ms-surface lg:gap-4 lg:border-t-0 lg:border-l lg:px-4 lg:py-4 lg:overflow-y-auto">
          {/* Petit écran : une ligne repliée ; la scène garde la place. */}
          <button type="button" onClick={() => setRailOpen((o) => !o)} aria-expanded={railOpen} aria-controls="participants-panel"
            className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-sm lg:hidden">
            <Users size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="text-ms-muted" />
            <span className="font-semibold">Participants</span>
            <span className="text-ms-muted tabular-nums">{call.peers.length + 1}</span>
            {isGame(slide) && students > 0 && (
              <span className="ms-status" data-state="info">{summary.answered} sur {students} {slide.kind === "write" ? "terminé" : "répondu"}</span>
            )}
            <ChevronDown size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className={`ms-auto text-ms-muted transition-transform duration-[140ms] ${railOpen ? "rotate-180" : ""}`} />
          </button>

          <div id="participants-panel" className={`${railOpen ? "flex" : "hidden"} flex-col gap-4 px-4 pb-4 lg:flex lg:p-0`}>
          <section aria-labelledby="participants-h">
            <h2 id="participants-h" className="hidden items-baseline justify-between gap-2 text-sm font-semibold lg:flex">
              Participants
              <span className="font-normal text-ms-muted tabular-nums">{call.peers.length + 1}</span>
            </h2>
            {call.error && <p role="alert" className="mt-2 rounded-xl bg-ms-danger-soft px-3 py-2 text-sm text-ms-danger">{call.error}</p>}
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:mt-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
              <li className="w-32 shrink-0 lg:col-span-2 lg:w-auto">
                <VideoTile stream={call.local} name={teacherName} cam={call.cam} mic={call.mic} self unavailable={!!call.error} />
              </li>
              {call.peers.map((peer) => (
                <li key={peer.session} className="w-28 shrink-0 lg:w-auto">
                  <VideoTile stream={peer.stream} name={peer.name} cam={peer.cam} mic={peer.mic} compact />
                </li>
              ))}
            </ul>
          </section>

          {isGame(slide) && (
            <section aria-labelledby="reponses-h" className="rounded-xl bg-ms-slate-soft px-3 py-3">
              <h2 id="reponses-h" className="text-sm font-semibold text-ms-slate-ink">Réponses</h2>
              <p className="mt-1 text-sm tabular-nums" aria-live="polite">
                {students === 0
                  ? "Aucun élève connecté."
                  : `${summary.answered} sur ${students} ${slide.kind === "write" ? "ont terminé" : "ont répondu"}`}
              </p>
              {summary.found.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {summary.found.map((name) => (
                    <li key={name} className="inline-flex items-center gap-1 rounded-full bg-ms-surface px-2.5 py-1 text-sm font-semibold">
                      <Check size={14} strokeWidth={2.5} aria-hidden="true" className="text-ms-ink" />
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          </div>
        </aside>
      </div>

      {/* Commandes : navigation, repère de l'activité, médias, puis fin du cours, à l'écart */}
      <nav aria-label="Commandes du cours" className="sticky bottom-0 z-10 flex min-h-20 flex-wrap items-center gap-x-3 gap-y-2 border-t border-ms-line bg-ms-surface px-4 py-3 ms-safe-bottom sm:px-6">
        {/* Rangée 1 : avancer dans la leçon. Sur petit écran, le repère de l'enseignant suit sur sa propre ligne. */}
        <div className="order-1 flex min-w-0 flex-1 gap-2 lg:flex-none">
          <Button variant="secondary" onClick={prev} disabled={isFirst} className="shrink-0" aria-label="Activité précédente">
            <ChevronLeft size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> <span className="hidden sm:inline">Précédent</span>
          </Button>
          <Button variant="primary" accent="slate" onClick={next} disabled={isLast} className="min-w-0 flex-1 lg:flex-none lg:min-w-32">
            Suivant <ChevronRight size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </Button>
        </div>

        <div className="order-3 min-w-0 basis-full empty:hidden lg:basis-0 lg:flex-1">
          <TeacherCue slide={slide} />
        </div>

        {/* Rangée 2 (petit écran) / même rangée (dès sm) : médias, puis la fin du cours à l'écart. */}
        <div className="order-4 flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <SoundUnlock />
          <CallButtons cam={call.cam} mic={call.mic} onCam={call.toggleCam} onMic={call.toggleMic} disabled={!call.local} />
          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="secondary" onClick={call.muteAll} disabled={call.peers.length === 0}>
              <MicOff size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> Micros des élèves
            </Button>
            <Button variant="quiet" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Maximize size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />}
              {fullscreen ? "Réduire" : "Plein écran"}
            </Button>
          </div>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button variant="quiet" className="lg:hidden" aria-label="Plus de commandes">
                <Ellipsis size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> Plus
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal container={root}>
              <DropdownMenu.Content side="top" align="start" sideOffset={8}
                className="z-50 flex min-w-56 flex-col gap-1 rounded-xl border border-ms-line bg-ms-surface p-1.5 shadow-[var(--ms-shadow-dialog)]">
                <DropdownMenu.Item disabled={call.peers.length === 0} onSelect={call.muteAll}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold outline-none data-[highlighted]:bg-ms-surface-muted data-[disabled]:cursor-not-allowed data-[disabled]:text-ms-muted">
                  <MicOff size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> Couper les micros des élèves
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={toggleFullscreen}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold outline-none data-[highlighted]:bg-ms-surface-muted">
                  {fullscreen ? <Minimize size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Maximize size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />}
                  {fullscreen ? "Réduire l'écran" : "Plein écran"}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="order-2 ms-auto lg:order-5 lg:border-l lg:border-ms-line lg:pl-3">
          <Dialog.Root open={confirmEnd} onOpenChange={setConfirmEnd}>
            <Dialog.Trigger asChild>
              <Button variant="danger" aria-label="Terminer le cours">
                <CircleStop size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /><span>Terminer<span className="hidden min-[440px]:inline"> le cours</span></span>
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal container={root}>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-ms-ink/30" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--ms-radius-dialog)] bg-ms-surface p-6 shadow-[var(--ms-shadow-dialog)]">
                <Dialog.Title className="text-xl leading-7 font-semibold">Terminer le cours pour toute la classe ?</Dialog.Title>
                <Dialog.Description className="mt-2 text-ms-muted">
                  Les élèves de {className} verront que le cours est terminé.
                </Dialog.Description>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button variant="secondary">Rester dans le cours</Button>
                  </Dialog.Close>
                  <Button variant="danger" onClick={() => { setConfirmEnd(false); quit(); }}>Terminer le cours</Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </nav>
    </div>
  );
}
