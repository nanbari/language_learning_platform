"use client";
/**
 * Éditeurs d'une activité de la leçon, un par type de bloc. Ils ne font que
 * présenter et modifier le bloc reçu : l'enregistrement audio, le
 * téléversement des vidéos et la sauvegarde restent dans la page.
 */
import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, ImagePlus, Image as ImageIcon, LayoutGrid, Plus, Trash2, Type, Upload, X } from "lucide-react";
import { ICON_STROKE } from "@/components/platform/ui";
import { AudioField, type AudioFieldState } from "@/components/teacher/builder/AudioField";
import type {
  AnswerMode, DragExercise, ExerciseAudioField, MatchExercise, QuizExercise, SlideshowBlock, VideoBlock, WordOrderExercise,
} from "@/components/teacher/builder/model";
import { uid } from "@/components/teacher/builder/model";

/** Ce que la page expose des enregistrements en cours. */
export interface RecorderView {
  /** État d'un emplacement audio : clé de l'emplacement, et s'il contient déjà un son. */
  stateFor: (key: string, hasAudio: boolean) => AudioFieldState;
  errorFor: (key: string) => string | null;
  elapsed: number;
  busy: boolean;
  stop: () => void;
}

export const slideAudioKey = (blockId: string, index: number) => `slide:${blockId}:${index}`;
export const exerciseAudioKey = (blockId: string, field: ExerciseAudioField) => `ex:${blockId}:${field}`;

/* ── Petits éléments de formulaire ── */

const ARABIC = /[\u0600-\u06FF]/;

/**
 * Attributs d'un champ qui peut recevoir de l'arabe : tant qu'il est vide ou
 * latin, il se comporte normalement ; dès qu'une lettre arabe apparaît, il
 * passe en Naskh, en grand, de droite à gauche. `dir="auto"` laisse le
 * navigateur suivre la première lettre saisie.
 */
function textProps(value: string) {
  const arabic = ARABIC.test(value);
  return arabic
    ? { lang: "ar", dir: "rtl" as const, className: "ms-field ms-arabic !text-2xl !leading-10 text-start" }
    : { dir: "auto" as const, className: "ms-field" };
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold leading-5">{label}</label>
      {children}
      {hint && <p id={`${htmlFor}-hint`} className="text-sm leading-5 text-ms-muted">{hint}</p>}
    </div>
  );
}

function SubHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-base font-semibold leading-6">{children}</h3>
      {aside && <span className="text-sm text-ms-muted">{aside}</span>}
    </div>
  );
}

function readImage(file: File, onLoad: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result as string);
  reader.readAsDataURL(file);
}

/** Une image choisie sur l'ordinateur (ou glissée), gardée dans la leçon jusqu'à l'enregistrement. */
function ImagePicker({ value, alt, label, onChange, className = "" }: {
  value?: string; alt: string; label: string; onChange: (dataUrl: string | undefined) => void; className?: string;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const pick = (file: File | undefined) => { if (file && file.type.startsWith("image/")) readImage(file, onChange); };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-ms-surface-muted ${over ? "border-ms-primary" : "border-ms-line"} ${className}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}>
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={alt} className="h-full w-full object-cover" />
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-2">
            <label htmlFor={id} className="ms-button cursor-pointer !min-h-11 !px-3 text-sm" data-variant="secondary">
              Remplacer
            </label>
            <button type="button" onClick={() => onChange(undefined)} data-variant="secondary" className="ms-button !min-h-11 !px-3"
              aria-label={`Retirer l'image : ${label}`}>
              <X size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <label htmlFor={id}
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-transparent p-3 text-center text-sm font-semibold text-ms-muted transition-colors duration-[140ms] hover:bg-ms-surface hover:text-ms-ink">
          <ImagePlus size={24} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span>Ajouter une image</span>
          <span className="sr-only">: {label}</span>
        </label>
      )}
      <input id={id} type="file" accept="image/*" className="sr-only"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-variant="quiet" className="ms-button shrink-0 !text-ms-muted" aria-label={label} title={label}>
      <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
    </button>
  );
}

/* ── Vidéo ── */

export function VideoEditor({ block, onChange, uploading, uploadPct, uploadBusy, onUpload }: {
  block: VideoBlock;
  onChange: (next: VideoBlock) => void;
  uploading: boolean;
  uploadPct: number;
  uploadBusy: boolean;
  onUpload: (file: File) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <Field label="Titre affiché (facultatif)" htmlFor={`${id}-t`}>
        <input id={`${id}-t`} className="ms-field" value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Ex : La chanson des lettres" />
      </Field>
      <Field label="Lien de la vidéo" htmlFor={`${id}-u`} hint="Un lien YouTube, ou l'adresse d'un fichier vidéo.">
        <input id={`${id}-u`} className="ms-field font-mono text-sm" value={block.url} inputMode="url" aria-describedby={`${id}-u-hint`}
          onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ms-surface-muted px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ms-muted">Ou téléversez un fichier depuis l&apos;ordinateur (200 Mo au plus).</p>
        {uploading ? (
          <div className="flex min-w-48 items-center gap-3" role="status">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ms-surface" aria-hidden="true">
              <div className="h-full rounded-full bg-ms-primary transition-[width] duration-[180ms]" style={{ width: `${uploadPct}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums">Téléversement… {uploadPct} %</span>
          </div>
        ) : (
          <label className={`ms-button ${uploadBusy ? "cursor-not-allowed" : "cursor-pointer"}`} data-variant="secondary" aria-disabled={uploadBusy}>
            <Upload size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Téléverser une vidéo
            <input type="file" accept="video/*" className="sr-only" disabled={uploadBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }} />
          </label>
        )}
      </div>
    </div>
  );
}

/* ── Leçon illustrée ── */

export function SlideshowEditor({ block, onChange, recorder, onRecord, onDeleteAudio }: {
  block: SlideshowBlock;
  onChange: (next: SlideshowBlock) => void;
  recorder: RecorderView;
  onRecord: (slideIdx: number) => void;
  onDeleteAudio: (slideIdx: number) => void;
}) {
  const id = useId();
  const setSlide = (si: number, patch: Partial<SlideshowBlock["slides"][number]>) =>
    onChange({ ...block, slides: block.slides.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const moveSlide = (si: number, dir: -1 | 1) => {
    const next = [...block.slides];
    [next[si], next[si + dir]] = [next[si + dir], next[si]];
    onChange({ ...block, slides: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <SubHeading aside={`${block.slides.length} image${block.slides.length > 1 ? "s" : ""}`}>Images de la leçon</SubHeading>
      <ol className="flex flex-col gap-4">
        {block.slides.map((slide, si) => {
          const key = slideAudioKey(block.id, si);
          return (
            <li key={slide.id} className="rounded-2xl border border-ms-line bg-ms-surface">
              <div className="flex items-center justify-between gap-3 border-b border-ms-line px-4 py-2">
                <span className="text-sm font-semibold">Image {si + 1}</span>
                <div className="flex items-center gap-1">
                  <button type="button" data-variant="quiet" className="ms-button !text-ms-muted" disabled={si === 0}
                    onClick={() => moveSlide(si, -1)} aria-label={`Monter l'image ${si + 1}`}>
                    <ChevronUp size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  </button>
                  <button type="button" data-variant="quiet" className="ms-button !text-ms-muted" disabled={si === block.slides.length - 1}
                    onClick={() => moveSlide(si, 1)} aria-label={`Descendre l'image ${si + 1}`}>
                    <ChevronDown size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  </button>
                  <RemoveButton label={`Supprimer l'image ${si + 1}`} disabled={block.slides.length === 1}
                    onClick={() => onChange({ ...block, slides: block.slides.filter((_, i) => i !== si) })} />
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <ImagePicker className="aspect-square w-full max-w-[10rem]" value={slide.imageDataUrl || undefined}
                  alt={slide.text || `Image ${si + 1}`} label={`image ${si + 1}`}
                  onChange={(url) => setSlide(si, { imageDataUrl: url ?? "" })} />
                <div className="flex min-w-0 flex-col gap-4">
                  <Field label="Texte sous l'image (facultatif)" htmlFor={`${id}-${slide.id}`}>
                    <textarea id={`${id}-${slide.id}`} {...textProps(slide.text ?? "")} className={`${textProps(slide.text ?? "").className} resize-y`} rows={2} value={slide.text ?? ""}
                      onChange={(e) => setSlide(si, { text: e.target.value })} placeholder="Texte affiché sous l'image" />
                  </Field>
                  <AudioField label="Votre voix (facultatif)"
                    state={recorder.stateFor(key, !!slide.audioDataUrl)} elapsed={recorder.elapsed}
                    audioUrl={slide.audioDataUrl} durationMs={slide.audioDuration} busy={recorder.busy}
                    error={recorder.errorFor(key)} onRecord={() => onRecord(si)} onStop={recorder.stop}
                    onDelete={() => onDeleteAudio(si)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" data-variant="secondary" className="ms-button self-start"
        onClick={() => onChange({ ...block, slides: [...block.slides, { id: uid(), imageDataUrl: "" }] })}>
        <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Ajouter une image
      </button>
    </div>
  );
}

/* ── Quiz ── */

const ANSWER_MODES: { value: AnswerMode; icon: typeof ImageIcon; label: string }[] = [
  { value: "image", icon: ImageIcon,  label: "Images" },
  { value: "text",  icon: Type,       label: "Texte" },
  { value: "both",  icon: LayoutGrid, label: "Les deux" },
];

export function QuizEditor({ blockId, quiz, onChange, recorder, onRecord, onDeleteAudio, error }: {
  blockId: string;
  quiz: QuizExercise;
  onChange: (next: QuizExercise) => void;
  recorder: RecorderView;
  onRecord: () => void;
  onDeleteAudio: () => void;
  /** Bonne réponse manquante, signalée au moment d'enregistrer. */
  error?: string | null;
}) {
  const id = useId();
  const key = exerciseAudioKey(blockId, "audioDataUrl");
  const showImage = quiz.answerMode === "image" || quiz.answerMode === "both";
  const showText  = quiz.answerMode === "text"  || quiz.answerMode === "both";
  const setOption = (oi: number, patch: Partial<QuizExercise["options"][number]>) =>
    onChange({ ...quiz, options: quiz.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });

  return (
    <div className="flex flex-col gap-6">
      <Field label="Question" htmlFor={`${id}-q`}>
        <input id={`${id}-q`} {...textProps(quiz.question)} value={quiz.question}
          onChange={(e) => onChange({ ...quiz, question: e.target.value })} placeholder="Ex : Où est la pomme ?" />
      </Field>

      <AudioField label="Question lue (facultatif)" hint="Votre voix lit la question à l'élève."
        state={recorder.stateFor(key, !!quiz.audioDataUrl)} elapsed={recorder.elapsed} audioUrl={quiz.audioDataUrl}
        busy={recorder.busy} error={recorder.errorFor(key)} onRecord={onRecord} onStop={recorder.stop} onDelete={onDeleteAudio} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold leading-5">Réponses en</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {ANSWER_MODES.map(({ value, icon: Icon, label }) => {
            const on = quiz.answerMode === value;
            return (
              <button key={value} type="button" role="radio" aria-checked={on}
                onClick={() => onChange({ ...quiz, answerMode: value })}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors duration-[140ms] ${
                  on ? "border-ms-primary bg-ms-primary-soft text-ms-primary" : "border-ms-control bg-ms-surface hover:bg-ms-surface-muted"
                }`}>
                <Icon size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3" aria-describedby={error ? `${id}-err` : `${id}-help`}>
        <legend className="text-sm font-semibold leading-5">Les trois réponses</legend>
        <p id={`${id}-help`} className="-mt-1 text-sm text-ms-muted">Touchez « Choisir celle-ci » sous la bonne réponse.</p>
        {error && <p id={`${id}-err`} role="alert" className="text-sm font-semibold text-ms-danger">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {quiz.options.map((opt, oi) => {
            const isCorrect = quiz.correctId === opt.id;
            return (
              <div key={opt.id} className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-3 transition-colors duration-[140ms] ${
                isCorrect ? "border-ms-primary bg-ms-primary-soft" : "border-ms-line bg-ms-surface"
              }`}>
                <p className="text-sm font-semibold">Réponse {oi + 1}</p>
                {showImage && (
                  <ImagePicker className="aspect-square w-full" value={opt.imageDataUrl} alt={opt.text || `Réponse ${oi + 1}`}
                    label={`réponse ${oi + 1}`} onChange={(url) => setOption(oi, { imageDataUrl: url })} />
                )}
                {showText && (
                  <>
                    <label htmlFor={`${id}-o${oi}`} className="sr-only">Texte de la réponse {oi + 1}</label>
                    <input id={`${id}-o${oi}`} {...textProps(opt.text)} value={opt.text} placeholder={`Réponse ${oi + 1}`}
                      onChange={(e) => setOption(oi, { text: e.target.value })} />
                  </>
                )}
                <button type="button" aria-pressed={isCorrect}
                  onClick={() => onChange({ ...quiz, correctId: opt.id })}
                  data-variant={isCorrect ? "primary" : "secondary"} className="ms-button w-full">
                  {isCorrect && <Check size={18} strokeWidth={2} aria-hidden="true" />}
                  {isCorrect ? "Bonne réponse" : "Choisir celle-ci"}
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

/* ── Appariement ── */

export function MatchingEditor({ ex, onChange }: { ex: MatchExercise; onChange: (next: MatchExercise) => void }) {
  const id = useId();
  const setPair = (pi: number, patch: Partial<MatchExercise["pairs"][number]>) =>
    onChange({ ...ex, pairs: ex.pairs.map((p, i) => (i === pi ? { ...p, ...patch } : p)) });
  return (
    <div className="flex flex-col gap-4">
      <SubHeading aside={`${ex.pairs.length} paire${ex.pairs.length > 1 ? "s" : ""}`}>Paires à associer</SubHeading>
      <ol className="flex flex-col gap-3">
        {ex.pairs.map((pair, pi) => (
          <li key={pair.id} className="flex flex-col gap-2 rounded-2xl border border-ms-line bg-ms-surface p-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label htmlFor={`${id}-${pi}l`} className="text-sm font-semibold">Paire {pi + 1} · à gauche</label>
              <input id={`${id}-${pi}l`} {...textProps(pair.left)} value={pair.left} onChange={(e) => setPair(pi, { left: e.target.value })} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label htmlFor={`${id}-${pi}r`} className="text-sm font-semibold">à droite</label>
              <input id={`${id}-${pi}r`} {...textProps(pair.right)} value={pair.right} onChange={(e) => setPair(pi, { right: e.target.value })} />
            </div>
            <RemoveButton label={`Supprimer la paire ${pi + 1}`} disabled={ex.pairs.length <= 2}
              onClick={() => onChange({ ...ex, pairs: ex.pairs.filter((_, i) => i !== pi) })} />
          </li>
        ))}
      </ol>
      <button type="button" data-variant="secondary" className="ms-button self-start"
        onClick={() => onChange({ ...ex, pairs: [...ex.pairs, { id: uid(), left: "", right: "" }] })}>
        <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Ajouter une paire
      </button>
    </div>
  );
}

/* ── Glisser-déposer ── */

export function DragDropEditor({ ex, onChange }: { ex: DragExercise; onChange: (next: DragExercise) => void }) {
  const id = useId();
  const setItem = (ii: number, patch: Partial<DragExercise["items"][number]>) =>
    onChange({ ...ex, items: ex.items.map((it, i) => (i === ii ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold">Catégories</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ex.categories.map((c, ci) => (
            <div key={c.id} className="flex flex-col gap-2">
              <label htmlFor={`${id}-c${ci}`} className="text-sm font-semibold">Catégorie {ci + 1}</label>
              <input id={`${id}-c${ci}`} className="ms-field" value={c.label}
                onChange={(e) => onChange({ ...ex, categories: ex.categories.map((k, i) => (i === ci ? { ...k, label: e.target.value } : k)) })} />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-3">
        <SubHeading aside={`${ex.items.length} élément${ex.items.length > 1 ? "s" : ""}`}>Éléments à classer</SubHeading>
        <ol className="flex flex-col gap-3">
          {ex.items.map((item, ii) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-2xl border border-ms-line bg-ms-surface p-3 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-[2] flex-col gap-2">
                <label htmlFor={`${id}-i${ii}`} className="text-sm font-semibold">Élément {ii + 1}</label>
                <input id={`${id}-i${ii}`} {...textProps(item.text)} value={item.text} onChange={(e) => setItem(ii, { text: e.target.value })} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label htmlFor={`${id}-s${ii}`} className="text-sm font-semibold">Va dans</label>
                <select id={`${id}-s${ii}`} className="ms-field" value={item.category} onChange={(e) => setItem(ii, { category: e.target.value })}>
                  {ex.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <RemoveButton label={`Supprimer l'élément ${ii + 1}`} disabled={ex.items.length <= 1}
                onClick={() => onChange({ ...ex, items: ex.items.filter((_, i) => i !== ii) })} />
            </li>
          ))}
        </ol>
        <button type="button" data-variant="secondary" className="ms-button self-start"
          onClick={() => onChange({ ...ex, items: [...ex.items, { id: uid(), text: "", category: ex.categories[0]?.id ?? "a" }] })}>
          <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Ajouter un élément
        </button>
      </div>
    </div>
  );
}

/* ── Mots dans l'ordre ── */

export function WordOrderEditor({ blockId, ex, onChange, recorder, onRecord, onDeleteAudio }: {
  blockId: string;
  ex: WordOrderExercise;
  onChange: (next: WordOrderExercise) => void;
  recorder: RecorderView;
  onRecord: (field: ExerciseAudioField) => void;
  onDeleteAudio: (field: ExerciseAudioField) => void;
}) {
  const id = useId();
  const words = ex.sentence.split(/\s+/).filter(Boolean);
  const audio = (field: ExerciseAudioField, label: string, hint: string, url?: string) => {
    const key = exerciseAudioKey(blockId, field);
    return (
      <AudioField label={label} hint={hint} state={recorder.stateFor(key, !!url)} elapsed={recorder.elapsed} audioUrl={url}
        busy={recorder.busy} error={recorder.errorFor(key)} onRecord={() => onRecord(field)} onStop={recorder.stop}
        onDelete={() => onDeleteAudio(field)} />
    );
  };
  return (
    <div className="flex flex-col gap-5">
      <Field label="Phrase modèle" htmlFor={`${id}-s`} hint="L'élève remet ces mots dans l'ordre.">
        <input id={`${id}-s`} {...textProps(ex.sentence)} value={ex.sentence} aria-describedby={`${id}-s-hint`}
          onChange={(e) => onChange({ ...ex, sentence: e.target.value })} placeholder="Ex : Le chat mange une souris" />
      </Field>
      {words.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Mots proposés</p>
          <ul className="flex flex-wrap gap-2">
            {words.map((word, i) => (
              <li key={i} className="rounded-lg border border-ms-line bg-ms-blush-soft px-3 py-1.5 text-sm font-semibold text-ms-blush-ink">{word}</li>
            ))}
          </ul>
        </div>
      )}
      {audio("audioDataUrl", "Consigne lue (facultatif)", "Votre voix lit la consigne.", ex.audioDataUrl)}
      {audio("answerAudioDataUrl", "Réponse lue (facultatif)", "Votre voix lit la phrase correcte, une fois trouvée.", ex.answerAudioDataUrl)}
    </div>
  );
}
