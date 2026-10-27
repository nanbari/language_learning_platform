"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, GripVertical, Plus, Settings2, X } from "lucide-react";
import { ICON_STROKE } from "@/components/platform/ui";
import { ACTIVITY_KINDS, FAMILY_TONE, blockIssue, blockSummary, kindMeta, kindOf, type ActivityFamily, type ActivityKind, type ContentBlock } from "@/components/teacher/builder/model";

export const SETTINGS = "settings";

/** Icône d'une activité, dans la couleur de sa famille (contenu, lettres, exercice). */
export function KindTile({ kind, size = "md" }: { kind: ActivityKind; size?: "md" | "lg" }) {
  const meta = kindMeta(kind);
  const tone = FAMILY_TONE[meta.family];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl ${size === "lg" ? "h-12 w-12" : "h-10 w-10"}`}
      style={{ background: tone.soft, color: tone.ink }}>
      <meta.icon size={size === "lg" ? 24 : 20} strokeWidth={ICON_STROKE} aria-hidden="true" />
    </span>
  );
}

/**
 * Plan de la leçon : les informations, puis les activités dans leur ordre.
 * Une activité se choisit d'un toucher ; l'ordre se change en la faisant
 * glisser, avec Alt + flèche, ou avec « Monter » / « Descendre » dans
 * l'éditeur.
 */
export function LessonOutline({ title, className, blocks, selectedId, settingsIssue, onSelect, onMove, onReorder, onAdd }: {
  title: string;
  className: string;
  blocks: ContentBlock[];
  selectedId: string;
  settingsIssue: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: () => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  return (
    <nav aria-label="Plan de la leçon" className="flex flex-col gap-4">
      <button type="button" onClick={() => onSelect(SETTINGS)} aria-current={selectedId === SETTINGS ? "true" : undefined}
        className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 text-start transition-colors duration-[140ms] ${
          selectedId === SETTINGS ? "border-ms-primary bg-ms-primary-soft" : "border-ms-line bg-ms-surface hover:bg-ms-surface-muted"
        }`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ms-surface-muted text-ms-ink">
          <Settings2 size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-5">Informations</span>
          <span className="block truncate text-sm leading-5 text-ms-muted">{title.trim() || "Titre à écrire"} · {className || "Classe à choisir"}</span>
        </span>
        {settingsIssue && <AlertCircle size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-ms-danger" aria-label="À compléter" />}
      </button>

      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold leading-5">Activités</h2>
        <span className="text-sm tabular-nums text-ms-muted">{blocks.length}</span>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ms-line px-4 py-5 text-sm text-ms-muted">
          Ajoutez une première activité : des lettres, une leçon illustrée, une vidéo ou un exercice.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {blocks.map((block, i) => {
            const kind = kindOf(block);
            const meta = kindMeta(kind);
            const issue = blockIssue(block);
            const selected = block.id === selectedId;
            return (
              <li key={block.id}
                draggable
                onDragStart={(e) => { setDragging(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                onDragOver={(e) => { if (dragging === null) return; e.preventDefault(); setOver(i); }}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) onReorder(dragging, i); setDragging(null); setOver(null); }}
                onDragEnd={() => { setDragging(null); setOver(null); }}
                className={`group relative rounded-2xl transition-opacity duration-[140ms] ${dragging === i ? "opacity-40" : ""}`}>
                {over === i && dragging !== null && dragging !== i && (
                  <span aria-hidden="true" className={`absolute inset-x-2 h-0.5 rounded-full bg-ms-primary ${dragging < i ? "-bottom-1" : "-top-1"}`} />
                )}
                <button type="button" onClick={() => onSelect(block.id)} aria-current={selected ? "true" : undefined}
                  aria-describedby={issue ? `issue-${block.id}` : undefined}
                  onKeyDown={(e) => {
                    if (!e.altKey) return;
                    if (e.key === "ArrowUp") { e.preventDefault(); onMove(block.id, -1); }
                    if (e.key === "ArrowDown") { e.preventDefault(); onMove(block.id, 1); }
                  }}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-2 py-2 text-start transition-colors duration-[140ms] ${
                    selected ? "border-ms-primary bg-ms-surface shadow-[var(--ms-shadow-control)]" : "border-transparent hover:bg-ms-surface"
                  }`}>
                  <GripVertical size={16} strokeWidth={ICON_STROKE} aria-hidden="true"
                    className="shrink-0 cursor-grab text-ms-muted opacity-60 group-hover:opacity-100" />
                  <KindTile kind={kind} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5 text-sm font-semibold leading-5">
                      <span className="tabular-nums text-ms-muted">{i + 1}.</span>
                      <span className="truncate">{meta.short}</span>
                    </span>
                    <span className="block truncate text-sm leading-5 text-ms-muted" dir="auto">{blockSummary(block)}</span>
                  </span>
                  {issue && (
                    <span id={`issue-${block.id}`} className="shrink-0 text-ms-danger" title={issue}>
                      <AlertCircle size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
                      <span className="sr-only">{issue}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" onClick={onAdd} data-variant="secondary" className="ms-button w-full border-dashed">
        <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Ajouter une activité
      </button>
      {blocks.length > 1 && (
        <p className="px-1 text-sm leading-5 text-ms-muted">Faites glisser une activité pour la déplacer, ou utilisez Alt + flèche.</p>
      )}
    </nav>
  );
}

const FAMILY_ORDER: ActivityFamily[] = ["letters", "content", "exercise"];

/** « Ajouter une activité » : un seul choix, avec des icônes et des libellés cohérents. */
export function AddActivityDialog({ open, onOpenChange, hasLetters, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasLetters: boolean;
  onPick: (kind: ActivityKind) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ms-ink/30" />
        <Dialog.Content data-ms-app="" data-ms-area="teacher"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[var(--ms-radius-dialog)] bg-ms-surface p-5 shadow-[var(--ms-shadow-dialog)] ms-safe-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--ms-radius-dialog)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold leading-7">Ajouter une activité</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ms-muted">Elle s&apos;ajoute à la fin de la leçon ; vous pourrez la déplacer.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" data-variant="quiet" className="ms-button -me-2 -mt-1" aria-label="Fermer">
                <X size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-5 flex flex-col gap-5">
            {FAMILY_ORDER.map((family) => (
              <section key={family} aria-label={FAMILY_TONE[family].label}>
                <h3 className="mb-2 text-sm font-semibold text-ms-muted">{FAMILY_TONE[family].label}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ACTIVITY_KINDS.filter((k) => k.family === family).map((k) => {
                    const disabled = k.kind === "letters" && hasLetters;
                    return (
                      <li key={k.kind}>
                        <button type="button" disabled={disabled} onClick={() => onPick(k.kind)}
                          className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-ms-line bg-ms-surface px-3 py-2 text-start transition-colors duration-[140ms] enabled:hover:border-ms-control enabled:hover:bg-ms-surface-muted disabled:cursor-not-allowed disabled:opacity-60">
                          <KindTile kind={k.kind} />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-5">{k.label}</span>
                            <span className="block text-sm leading-5 text-ms-muted">
                              {disabled ? "La leçon a déjà un bloc « Lettres »." : k.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
