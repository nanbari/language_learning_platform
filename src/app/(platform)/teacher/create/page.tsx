"use client";
import { useState, useRef, useEffect, useId, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, Ellipsis, Check, ChevronDown, ChevronUp, Copy, Eye, Presentation, Save, Trash2, X } from "lucide-react";
import { uploadMedia, externalizeMediaToR2 } from "@/lib/mediaUpload";
import { fetchLesson, createLesson, updateLesson } from "@/lib/api/lessons";
import { ApiError } from "@/lib/api/client";
import { fetchTeacherClasses } from "@/lib/api/classes";
import type { ClassRow } from "@/lib/classes";
import type { LettersBlock, SavedDeck } from "@/lib/liveDeck";
import dynamic from "next/dynamic";
import { Button, ICON_STROKE, InlineNotice, StatusPill } from "@/components/platform/ui";
import { blockIssue, blockSummary, duplicateOf, kindMeta, kindOf, makeBlock, type ActivityKind, type ContentBlock, type Exercise, type ExerciseBlock } from "@/components/teacher/builder/model";
import { DragDropEditor, Field, MatchingEditor, QuizEditor, SlideshowEditor, VideoEditor, WordOrderEditor } from "@/components/teacher/builder/BlockEditors";
import { AddActivityDialog, KindTile, LessonOutline, SETTINGS } from "@/components/teacher/builder/LessonOutline";
import { StudentPreview } from "@/components/teacher/builder/StudentPreview";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

// Voice-only constraints + recorder options: mono, low bitrate Opus.
// ~32 kbps mono Opus = clear speech at roughly 1/4 the size of default WebM.
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const timeFmt = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" });

type Pane = "plan" | "activite" | "apercu";

/* ════════════════════════════════════════════
   Main component
════════════════════════════════════════════ */
// Le choix des lettres embarque les tracés de tout l'alphabet : chargé seulement pour un bloc « lettres ».
const LettersPicker = dynamic(() => import("@/components/present/LettersPicker").then((m) => m.LettersPicker), {
  ssr: false,
  loading: () => <div className="ms-skeleton h-40" aria-busy="true" />,
});

function CreateLessonPageInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const editId      = searchParams.get("edit");
  /** Depuis l'espace d'une classe : la nouvelle leçon lui est proposée d'office. */
  const presetClassId = searchParams.get("class");
  const ids = useId();

  const [title,  setTitleRaw]  = useState("");
  /** Classe à qui la leçon est proposée : seuls ses élèves la voient. */
  const [classId, setClassIdRaw] = useState("");
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [blocks, setBlocksRaw] = useState<ContentBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  /** Diaporama du cours en direct déjà enregistré, et état de sa création. */
  const [live,      setLive]      = useState<SavedDeck | null>(null);
  /** Version de la leçon telle qu'ouverte ; null = inconnue (avant la migration) ou écrasement demandé. */
  const [version,   setVersion]   = useState<number | null>(null);
  const [conflict,  setConflict]  = useState(false);
  const [deckState, setDeckState] = useState<"idle" | "sending" | "saved" | "uptodate">("idle");
  /** Le diaporama ne correspond plus à la leçon enregistrée (calculé par le serveur, relu après chaque enregistrement). */
  const [liveStale, setLiveStale] = useState<boolean | null>(null);

  /* ── Modifications non enregistrées : un compteur, comparé à celui du dernier enregistrement ── */
  const [rev, setRev] = useState(0);
  const [savedRev, setSavedRev] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirty = rev !== savedRev;
  const revRef = useRef(0);
  const touch = () => { revRef.current += 1; setRev(revRef.current); setDeckState("idle"); };
  const setBlocks: typeof setBlocksRaw = (v) => { setBlocksRaw(v); touch(); };
  const setTitle = (v: string) => { setTitleRaw(v); touch(); };
  const setClassId = (v: string) => { setClassIdRaw(v); touch(); };

  /* ── Espace de travail ── */
  const [selectedId, setSelectedId] = useState<string>(SETTINGS);
  const [pane, setPane] = useState<Pane>("activite");
  const [adding, setAdding] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [removed, setRemoved] = useState<{ block: ContentBlock; index: number } | null>(null);
  const [loadState, setLoadState] = useState<"ready" | "loading" | "missing">(editId ? "loading" : "ready");
  const isXl = useMedia("(min-width: 80rem)");
  const isLg = useMedia("(min-width: 64rem)");
  /** Leçon créée à l'instant : son ?edit= ne doit pas la recharger par-dessus ce qui est affiché. */
  const justCreated = useRef<string | null>(null);

  /* ── Classes de l'enseignant ── */
  useEffect(() => {
    fetchTeacherClasses()
      .then(({ classes }) => {
        setClasses(classes);
        if (editId) return;
        // Nouvelle leçon : la classe d'où l'on vient, sinon la seule classe, est choisie d'office.
        if (presetClassId && classes.some((c) => c.id === presetClassId)) setClassIdRaw(presetClassId);
        else if (classes.length === 1) setClassIdRaw(classes[0].id);
      })
      .catch(() => setClasses([]));
  }, [editId, presetClassId]);

  /* ── Load for edit ── */
  useEffect(() => {
    if (!editId || justCreated.current === editId) return;
    (async () => {
      const lesson = await fetchLesson(editId).catch(() => null);
      if (!lesson) { setLoadState("missing"); return; }
      setTitleRaw(lesson.title);
      setClassIdRaw(lesson.classId ?? "");
      // Les vidéos d'introduction (abandonnées) sont retirées de la leçon à la prochaine sauvegarde.
      const loaded = (lesson.blocks as (ContentBlock & { recap?: boolean })[]).filter((b) => !b.recap);
      setBlocksRaw(loaded);
      setLive(lesson.live);
      setLiveStale(lesson.liveStale);
      setVersion(lesson.version);
      setSelectedId(loaded[0]?.id ?? SETTINGS);
      setLoadState("ready");
    })();
  }, [editId]);

  /* ── Quitter avec des modifications non enregistrées ── */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const { recorder, startExerciseAudioRecording, startSlideRecording, deleteExerciseAudio, deleteSlideAudio } = useVoiceRecorder(setBlocks);

  /* ── Video upload (R2) ── */
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const handleVideoFile = async (blockId: string, file: File) => {
    if (uploadingBlockId !== null) return;
    if (file.size > 200 * 1024 * 1024) { setError("Vidéo trop lourde (200 Mo au plus)."); return; }
    setError("");
    setUploadingBlockId(blockId);
    setUploadPct(0);
    try {
      const url = await uploadMedia(file, setUploadPct);
      setBlocks((prev) => prev.map((b) =>
        b.id === blockId && b.type === "video" ? { ...b, url } : b
      ));
    } catch (err) {
      setError(`Téléversement impossible : ${(err as Error).message}`);
    } finally {
      setUploadingBlockId(null);
    }
  };

  /* ── Block operations ── */
  const addBlock = (kind: ActivityKind) => {
    const block = makeBlock(kind);
    setBlocks((p) => [...p, block]);
    setSelectedId(block.id);
    setPane("activite");
    setAdding(false);
  };

  const removeBlock = (id: string) => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    setRemoved({ block: blocks[index], index });
    setBlocks((p) => p.filter((b) => b.id !== id));
    const neighbour = blocks[index + 1] ?? blocks[index - 1];
    setSelectedId(neighbour?.id ?? SETTINGS);
  };

  const undoRemove = () => {
    if (!removed) return;
    const { block, index } = removed;
    setBlocks((p) => { const next = [...p]; next.splice(Math.min(index, next.length), 0, block); return next; });
    setSelectedId(block.id);
    setRemoved(null);
  };

  const duplicateBlock = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i === -1) return;
    const copy = duplicateOf(blocks[i]);
    setBlocks((prev) => { const next = [...prev]; next.splice(i + 1, 0, copy); return next; });
    setSelectedId(copy.id);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i + dir < 0 || i + dir >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  };

  const reorderBlock = (from: number, to: number) => {
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const updateBlock = (id: string, updater: (b: ContentBlock) => ContentBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? updater(b) : b)));

  const updateExercise = (blockId: string, updater: (ex: Exercise) => Exercise) =>
    updateBlock(blockId, (b) => b.type === "exercise" ? { ...b, exercise: updater(b.exercise) } : b);

  /* ── Save ── */
  /** Ce qui empêche d'enregistrer, et où le corriger. */
  const validate = (): { message: string; target: string } | null => {
    if (!title.trim()) return { message: "Veuillez donner un titre à la leçon.", target: SETTINGS };
    if (!classId) return { message: "Choisissez la classe à qui proposer la leçon.", target: SETTINGS };
    const quiz = blocks.find((b) => b.type === "exercise" && b.exercise.type === "quiz" && blockIssue(b));
    if (quiz) return { message: "Marquez la bonne réponse pour chaque exercice quiz.", target: quiz.id };
    const letters = blocks.find((b): b is LettersBlock => b.type === "letters" && !!blockIssue(b));
    if (letters) return { message: `${blockIssue(letters)!.replace(/\.$/, "")} dans le bloc « Lettres ».`, target: letters.id };
    return null;
  };

  /** Enregistre la leçon ; renvoie son id, ou null si elle n'est pas valide ou si l'enregistrement échoue. */
  const persist = async (): Promise<string | null> => {
    setError("");
    const problem = validate();
    if (problem) {
      setError(problem.message);
      setShowIssues(true);
      setSelectedId(problem.target);
      setPane("activite");
      return null;
    }

    const startedAt = revRef.current;
    setSaving(true);
    try {
      // Les images/audios encore inline partent vers R2 ; la base ne reçoit
      // que du JSON avec des URLs.
      const cleanBlocks = (await externalizeMediaToR2(blocks)) as unknown[];
      // Après un conflit, le second clic écrase volontairement (version omise).
      const saved = editId
        ? await updateLesson(editId, title.trim(), classId, cleanBlocks, conflict ? null : version)
        : await createLesson(title.trim(), classId, cleanBlocks);
      const id = saved.id;
      setVersion(saved.version);
      setConflict(false);
      // Rien n'a bougé pendant l'envoi : la leçon affichée reprend les adresses des médias envoyés.
      if (revRef.current === startedAt) setBlocksRaw(cleanBlocks as ContentBlock[]);
      setSavedRev(startedAt);
      setSavedAt(new Date());
      setShowIssues(false);
      if (!editId) {
        justCreated.current = id;
        router.replace(`/teacher/create?edit=${id}`);
      }
      // Le serveur sait si le diaporama correspond encore à la leçon enregistrée : on le relit plutôt que de le deviner.
      if (live) {
        const fresh = await fetchLesson(id).catch(() => null);
        if (fresh) { setLive(fresh.live); setLiveStale(fresh.liveStale); }
      }
      return id;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
        setError("La leçon a été modifiée ailleurs (autre onglet ou collègue). Vos modifications sont toujours affichées : rechargez la page pour voir la version enregistrée, ou enregistrez à nouveau pour l'écraser.");
        return null;
      }
      setError(`L'enregistrement a échoué (${(err as Error).message || "erreur inconnue"}). Vos modifications sont toujours affichées.`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => { void persist(); };

  /** Enregistre la leçon, puis construit et enregistre son diaporama du cours en direct. */
  const createDeck = async () => {
    const id = await persist();
    if (!id) return;
    setDeckState("sending");
    try {
      const res = await fetch("/api/live-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: id }),
      });
      const data = await res.json().catch(() => null) as { deck?: SavedDeck; changed?: boolean; error?: string } | null;
      if (!res.ok || !data?.deck) throw new Error(data?.error ?? `Erreur serveur (${res.status})`);
      setLive(data.deck);
      // Il vient d'être construit depuis la leçon qui vient d'être enregistrée : il est à jour.
      setLiveStale(false);
      setDeckState(data.changed ? "saved" : "uptodate");
    } catch (err) {
      setError(`Le diaporama n'a pas pu être créé : ${(err as Error).message}.`);
      setDeckState("idle");
    }
  };

  // Ctrl/Cmd + S : enregistrer, comme dans un traitement de texte.
  const saveRef = useRef(handleSave);
  useEffect(() => { saveRef.current = handleSave; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Un admin voit les classes de tous les enseignants : on précise à qui chacune appartient.
  const multiTeacher = new Set((classes ?? []).map((c) => c.teacherId)).size > 1;
  const className = (classes ?? []).find((c) => c.id === classId)?.name ?? "";

  const selectedIndex = blocks.findIndex((b) => b.id === selectedId);
  const selected = selectedIndex >= 0 ? blocks[selectedIndex] : null;
  const previewStart = Math.max(selectedIndex, 0);

  const select = (id: string) => { setSelectedId(id); setPane("activite"); };

  /* ── Statut d'enregistrement, toujours au même endroit ── */
  // Pas d'état « brouillon » : une leçon enregistrée est aussitôt visible par la classe choisie.
  const visibleBy = className ? ` · visible par la classe ${className}` : "";
  const status = saving ? { text: "Enregistrement…", tone: "muted" as const }
    : error && !dirty && !savedAt ? { text: "Non enregistrée", tone: "danger" as const }
    : dirty ? { text: "Modifications non enregistrées", tone: "review" as const }
    : savedAt ? { text: `Enregistré à ${timeFmt.format(savedAt)}${visibleBy}`, tone: "success" as const }
    : editId ? { text: `Leçon enregistrée${visibleBy}`, tone: "muted" as const }
    : { text: "Pas encore enregistrée", tone: "muted" as const };

  /* ── Diaporama du cours en direct : un seul état à la fois, d'après le serveur ── */
  const deckCreatedAt = live ? new Date(live.createdAt).toLocaleString("fr-BE", { dateStyle: "long", timeStyle: "short" }) : "";
  const deck = !live ? { kind: "none" as const }
    : liveStale === true ? { kind: "stale" as const }
    : liveStale === false ? { kind: "fresh" as const }
    : { kind: "unknown" as const };

  if (loadState === "missing") {
    return (
      <div data-ms-app="" data-ms-area="teacher" className="flex min-h-dvh items-center justify-center bg-ms-canvas px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-xl font-semibold">Cette leçon est introuvable.</p>
          <p className="text-ms-muted">Elle a peut-être été supprimée.</p>
          <Link href="/teacher#lecons" data-variant="primary" className="ms-button">
            <ArrowLeft size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Retour aux leçons
          </Link>
        </div>
      </div>
    );
  }

  /* ── Panneau « Informations » ── */
  const settingsPanel = (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold leading-7 tracking-[-0.01em]">Informations</h2>
        <p className="mt-1 text-sm text-ms-muted">Il n&apos;y a pas de brouillon : à chaque enregistrement, la leçon est visible par les élèves de la classe choisie.</p>
      </div>
      <section className="ms-panel flex flex-col gap-5 p-5">
        <Field label="Titre de la leçon" htmlFor={`${ids}-title`}>
          <input id={`${ids}-title`} className="ms-field" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Les animaux de la forêt" required
            aria-invalid={showIssues && !title.trim() ? true : undefined} />
        </Field>
        <Field label="Classe" htmlFor={`${ids}-class`}
          hint={classes && classes.length === 0 ? undefined : className ? (
            <>
              Visible par les élèves de {className} dès l&apos;enregistrement.{" "}
              <Link href={`/teacher/classes#${classId}`} className="font-semibold text-ms-primary underline-offset-4 hover:underline">Ouvrir la classe</Link>
            </>
          ) : "Seuls les élèves de la classe choisie verront la leçon, dès son enregistrement."}>
          {classes && classes.length === 0 ? (
            <p className="rounded-xl bg-ms-surface-muted px-4 py-3 text-sm">
              Aucune classe pour l&apos;instant.{" "}
              <Link href="/teacher/classes" className="font-semibold text-ms-primary underline underline-offset-4">Créez une classe</Link>{" "}
              pour lui proposer cette leçon.
            </p>
          ) : (
            <select id={`${ids}-class`} className="ms-field" value={classId} onChange={(e) => setClassId(e.target.value)}
              aria-describedby={`${ids}-class-hint`} aria-invalid={showIssues && !classId ? true : undefined} required>
              <option value="">Choisir une classe</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{multiTeacher ? ` (${c.teacherName})` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>

      <section aria-labelledby={`${ids}-deck`} className="flex flex-col gap-4 rounded-[var(--ms-radius-panel)] border border-ms-line bg-ms-slate-soft p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ms-surface text-ms-slate-ink">
            <Presentation size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id={`${ids}-deck`} className="font-semibold">Diaporama du cours en direct</h3>
            <p className="mt-1 max-w-[62ch] text-sm leading-5 text-ms-muted">
              Le cours en direct projette ce diaporama, pas la leçon elle-même : il reprend les lettres du bloc « Lettres » et les images
              des leçons illustrées, dans l&apos;ordre de la leçon. Les élèves, eux, voient la leçon dès qu&apos;elle est enregistrée.
            </p>
          </div>
        </div>
        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          {deck.kind === "none" && <StatusPill state="neutral">Pas de diaporama</StatusPill>}
          {deck.kind === "fresh" && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusPill state="success" icon={Check}>Diaporama à jour</StatusPill>
              <span className="text-ms-muted">créé le {deckCreatedAt} · {live!.slides.length} écrans</span>
            </p>
          )}
          {deck.kind === "stale" && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusPill state="review">Diaporama à mettre à jour</StatusPill>
              <span className="text-ms-muted">la leçon a changé depuis sa création, le {deckCreatedAt}</span>
            </p>
          )}
          {deck.kind === "unknown" && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusPill state="neutral">Diaporama créé</StatusPill>
              <span className="text-ms-muted">le {deckCreatedAt} · {live!.slides.length} écrans</span>
            </p>
          )}
          {deckState === "uptodate" && <p className="text-ms-slate-ink">Le diaporama correspondait déjà au contenu enregistré : rien à refaire.</p>}
          {deckState === "saved" && <p className="text-ms-slate-ink">Le diaporama est enregistré ; vous le retrouvez dans « Cours en direct ».</p>}
          {dirty && live && (
            <p className="text-ms-muted">Les modifications en cours ne sont pas encore enregistrées : le bouton enregistre la leçon avant de refaire le diaporama.</p>
          )}
        </div>
        <Button variant={deck.kind === "stale" ? "primary" : "secondary"} onClick={() => void createDeck()} disabled={saving || deckState === "sending"} className="self-start">
          <Presentation size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
          {deckState === "sending" ? "Création du diaporama…"
            : deck.kind === "none" ? (dirty || !editId ? "Enregistrer et créer le diaporama" : "Créer le diaporama")
            : (dirty ? "Enregistrer et mettre à jour le diaporama" : "Mettre à jour le diaporama")}
        </Button>
      </section>
    </div>
  );

  /* ── Activité sélectionnée ── */
  const activityPanel = selected && (() => {
    const kind = kindOf(selected);
    const meta = kindMeta(kind);
    const isFirst = selectedIndex === 0;
    const isLast = selectedIndex === blocks.length - 1;
    const issue = showIssues ? blockIssue(selected) : null;
    return (
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center gap-3">
          <KindTile kind={kind} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-semibold leading-[1.125rem] text-ms-muted tabular-nums">Activité {selectedIndex + 1} sur {blocks.length}</p>
            <h2 className="truncate text-xl font-semibold leading-7 tracking-[-0.01em]">
              <span className="md:hidden">{meta.short}</span><span className="hidden md:inline">{meta.label}</span>
            </h2>
          </div>
          {/* Grand écran : actions visibles. Petit écran : un menu « Options », la tâche d'abord. */}
          <div className="hidden items-center gap-1 md:flex" role="toolbar" aria-label="Actions sur l'activité">
            <Button variant="quiet" onClick={() => moveBlock(selected.id, -1)} disabled={isFirst} aria-label="Monter l'activité" title="Monter" className="disabled:!bg-transparent">
              <ChevronUp size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </Button>
            <Button variant="quiet" onClick={() => moveBlock(selected.id, 1)} disabled={isLast} aria-label="Descendre l'activité" title="Descendre" className="disabled:!bg-transparent">
              <ChevronDown size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </Button>
            {selected.type !== "letters" && (
              <Button variant="quiet" onClick={() => duplicateBlock(selected.id)}>
                <Copy size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Dupliquer
              </Button>
            )}
            <Button variant="quiet" onClick={() => removeBlock(selected.id)} className="!text-ms-danger">
              <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Supprimer
            </Button>
          </div>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button variant="secondary" className="md:hidden" aria-label="Options de l'activité">
                <Ellipsis size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Options
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content data-ms-app="" data-ms-area="teacher" align="end" sideOffset={6}
                className="z-50 flex min-w-60 flex-col gap-0.5 rounded-xl border border-ms-line bg-ms-surface p-1.5 shadow-[var(--ms-shadow-dialog)]">
                {[
                  { label: "Monter", icon: ChevronUp, run: () => moveBlock(selected.id, -1), disabled: isFirst },
                  { label: "Descendre", icon: ChevronDown, run: () => moveBlock(selected.id, 1), disabled: isLast },
                  ...(selected.type !== "letters" ? [{ label: "Dupliquer", icon: Copy, run: () => duplicateBlock(selected.id), disabled: false }] : []),
                ].map(({ label, icon: Icon, run, disabled }) => (
                  <DropdownMenu.Item key={label} disabled={disabled} onSelect={run}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold outline-none data-[highlighted]:bg-ms-surface-muted data-[disabled]:cursor-not-allowed data-[disabled]:text-ms-muted">
                    <Icon size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {label}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-ms-line" />
                <DropdownMenu.Item onSelect={() => removeBlock(selected.id)}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold text-ms-danger outline-none data-[highlighted]:bg-ms-danger-soft">
                  <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Supprimer l&apos;activité
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {issue && selected.type === "letters" && (
          <InlineNotice tone="error">{issue}</InlineNotice>
        )}

        <section className="ms-panel p-4 sm:p-6" aria-label={`Contenu : ${meta.label}`}>
          {selected.type === "letters" && (
            <LettersPicker value={selected}
              onChange={(choice) => updateBlock(selected.id, (b) => ({ ...(b as LettersBlock), ...choice }))} />
          )}
          {selected.type === "video" && (
            <VideoEditor block={selected} onChange={(next) => updateBlock(selected.id, () => next)}
              uploading={uploadingBlockId === selected.id} uploadPct={uploadPct} uploadBusy={uploadingBlockId !== null}
              onUpload={(file) => void handleVideoFile(selected.id, file)} />
          )}
          {selected.type === "slideshow" && (
            <SlideshowEditor block={selected} onChange={(next) => updateBlock(selected.id, () => next)} recorder={recorder}
              onRecord={(si) => void startSlideRecording(selected.id, si)} onDeleteAudio={(si) => deleteSlideAudio(selected.id, si)} />
          )}
          {selected.type === "exercise" && (() => {
            const ex = (selected as ExerciseBlock).exercise;
            if (ex.type === "quiz") return (
              <QuizEditor blockId={selected.id} quiz={ex} onChange={(next) => updateExercise(selected.id, () => next)} recorder={recorder}
                onRecord={() => void startExerciseAudioRecording(selected.id)} onDeleteAudio={() => deleteExerciseAudio(selected.id)}
                error={issue} />
            );
            if (ex.type === "matching") return <MatchingEditor ex={ex} onChange={(next) => updateExercise(selected.id, () => next)} />;
            if (ex.type === "dragdrop") return <DragDropEditor ex={ex} onChange={(next) => updateExercise(selected.id, () => next)} />;
            return (
              <WordOrderEditor blockId={selected.id} ex={ex} onChange={(next) => updateExercise(selected.id, () => next)} recorder={recorder}
                onRecord={(field) => void startExerciseAudioRecording(selected.id, field)} onDeleteAudio={(field) => deleteExerciseAudio(selected.id, field)} />
            );
          })()}
        </section>
        <p className="text-sm text-ms-muted" dir="auto">{blockSummary(selected)}</p>
      </div>
    );
  })();

  const loading = loadState === "loading";
  const outline = (
    <LessonOutline title={title} className={className} blocks={blocks} selectedId={selectedId}
      settingsIssue={showIssues && (!title.trim() || !classId)}
      onSelect={select} onMove={moveBlock} onReorder={reorderBlock} onAdd={() => setAdding(true)} />
  );
  const preview = (label?: string) => (
    <StudentPreview title={title} blocks={blocks} startIndex={previewStart} label={label} className="h-full" />
  );

  return (
    <div data-ms-app="" data-ms-area="teacher" className="min-h-dvh bg-ms-canvas text-ms-ink">
      <a href="#editeur"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-ms-surface focus:px-4 focus:py-3 focus:font-semibold">
        Aller à l&apos;éditeur
      </a>

      {/* ── Barre d'outils : retour, titre et statut, aperçu, enregistrer ── */}
      <header className="sticky top-0 z-40 border-b border-ms-line bg-ms-surface">
        <div className="mx-auto flex min-h-[4.5rem] max-w-[100rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 xl:px-8">
          <Link href="/teacher#lecons" data-variant="quiet" className="ms-button -ms-2 shrink-0" aria-label="Retour aux leçons">
            <ArrowLeft size={20} strokeWidth={ICON_STROKE} aria-hidden="true" /> <span className="hidden sm:inline">Leçons</span>
          </Link>
          <span aria-hidden="true" className="hidden h-8 w-px bg-ms-line sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-6 sm:text-lg">
              {title.trim() || (editId ? "Leçon sans titre" : "Nouvelle leçon")}
            </h1>
            <p aria-live="polite" className={`flex items-center gap-1.5 text-sm leading-5 ${
              status.tone === "danger" ? "text-ms-danger" : status.tone === "review" ? "text-ms-review" : status.tone === "success" ? "text-ms-primary" : "text-ms-muted"
            }`}>
              {status.tone === "success" && <Check size={16} strokeWidth={2} aria-hidden="true" />}
              {status.tone === "review" && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ms-review" />}
              {status.text}
            </p>
          </div>
          {isLg && !isXl && (
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Eye size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Voir comme un élève
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} disabled={saving || loading} aria-keyshortcuts="Control+S">
            <Save size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="min-w-[6.5rem]">{saving ? "Enregistrement…" : <>Enregistrer<span className="hidden lg:inline">{editId ? " les modifications" : " la leçon"}</span></>}</span>
          </Button>
        </div>

        {/* Téléphone et tablette : un volet à la fois. */}
        {!isLg && (
          <div role="tablist" aria-label="Volets de l'éditeur" className="mx-auto grid max-w-[100rem] grid-cols-3 gap-1 px-4 pb-2 sm:px-6">
            {([["plan", "Plan"], ["activite", "Activité"], ["apercu", "Aperçu"]] as const).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)}
                className={`min-h-11 rounded-xl text-sm font-semibold transition-colors duration-[140ms] ${
                  pane === key ? "bg-ms-primary-soft text-ms-primary" : "text-ms-muted hover:bg-ms-surface-muted"
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[14rem_minmax(0,1fr)_20rem] xl:px-8 xl:py-8">
        {/* Plan */}
        <aside className={`${!isLg && pane !== "plan" ? "hidden" : ""} lg:sticky lg:top-[6rem] lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto lg:pe-1`}>
          {loading ? (
            <div aria-busy="true" aria-label="Chargement du plan" className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="ms-skeleton h-16 w-full rounded-2xl" />)}
            </div>
          ) : outline}
        </aside>

        {/* Éditeur */}
        <main id="editeur" tabIndex={-1} className={`${!isLg && pane !== "activite" ? "hidden" : ""} min-w-0 focus:outline-none`}>
          <div className="mx-auto flex max-w-[52rem] flex-col gap-5">
            {error && (
              <InlineNotice tone="error" action={
                <button type="button" onClick={() => setError("")} data-variant="quiet" className="ms-button !min-h-9 !px-2 !text-ms-danger" aria-label="Masquer le message">
                  <X size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
              }>
                {error}
              </InlineNotice>
            )}
            {removed && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-ms-surface-muted px-4 py-2 text-sm">
                <span className="min-w-0 flex-1">Activité supprimée : {kindMeta(kindOf(removed.block)).label}.</span>
                <Button variant="secondary" onClick={undoRemove}>Annuler</Button>
                <Button variant="quiet" onClick={() => setRemoved(null)} aria-label="Masquer">
                  <X size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </Button>
              </div>
            )}
            {loading ? (
              <div aria-busy="true" aria-label="Chargement de la leçon" className="flex flex-col gap-4">
                <div className="ms-skeleton h-12 w-64" />
                <div className="ms-skeleton h-80 w-full rounded-2xl" />
              </div>
            ) : selected ? activityPanel : settingsPanel}

            {!loading && blocks.length === 0 && selectedId === SETTINGS && (
              <section className="flex flex-col items-start gap-3 rounded-[var(--ms-radius-panel)] border border-dashed border-ms-control bg-ms-surface p-5">
                <h2 className="font-semibold">Préparez votre première activité</h2>
                <p className="max-w-[56ch] text-sm text-ms-muted">Des lettres, une leçon illustrée, une vidéo ou un exercice : la leçon se construit activité par activité.</p>
                <Button variant="primary" onClick={() => setAdding(true)}>Ajouter une activité</Button>
              </section>
            )}
          </div>
        </main>

        {/* Aperçu : colonne dès 1280 px, panneau à la demande dès 1024 px, onglet en dessous. */}
        {isXl && (
          <div className="sticky top-[6rem] h-[calc(100dvh-7.5rem)] self-start">
            {preview()}
          </div>
        )}
        {!isLg && pane === "apercu" && (
          <div className="mx-auto h-[calc(100dvh-10rem)] w-full max-w-md">
            {preview()}
          </div>
        )}
      </div>

      {isLg && !isXl && (
        <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-ms-ink/30" />
            <Dialog.Content data-ms-app="" data-ms-area="teacher"
              className="fixed inset-y-0 right-0 z-50 flex w-[min(26rem,100vw)] flex-col gap-4 bg-ms-surface p-5 shadow-[var(--ms-shadow-dialog)]">
              <div className="flex items-center justify-between gap-3">
                <Dialog.Title className="text-xl font-semibold">Voir comme un élève</Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" data-variant="quiet" className="ms-button" aria-label="Fermer l'aperçu">
                    <X size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">La leçon en cours, jouée comme sur l&apos;écran d&apos;un élève.</Dialog.Description>
              <div className="min-h-0 flex-1">{preview("Activité sélectionnée")}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <AddActivityDialog open={adding} onOpenChange={setAdding} hasLetters={blocks.some((b) => b.type === "letters")} onPick={addBlock} />
    </div>
  );
}

export default function CreateLessonPage() {
  return (
    <Suspense fallback={<div data-ms-app="" data-ms-area="teacher" className="min-h-dvh bg-ms-canvas" aria-busy="true" />}>
      <CreateLessonPageInner />
    </Suspense>
  );
}
