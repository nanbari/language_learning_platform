"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Lightbulb, Search } from "lucide-react";
import { Button, EmptyState, ICON_STROKE } from "@/components/platform/ui";

export interface LibraryItem {
  key: string;
  hasAudio: boolean;
  /** Texte où chercher (nom, translittération, traduction…). */
  search: string;
}

type Filter = "all" | "recorded" | "missing";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ًͯ-ْ]/g, "").toLowerCase().trim();

/**
 * Liste d'une bibliothèque audio : recherche, filtre par état
 * (Tous · Enregistrés · Manquants) et lignes compactes. La ligne en cours
 * d'enregistrement reste toujours affichée, quel que soit le filtre.
 */
export function AudioLibraryPanel<T extends LibraryItem>({
  items, pinnedKey, renderRow, searchLabel, listLabel,
}: {
  items: T[];
  pinnedKey: string | null;
  renderRow: (item: T) => ReactNode;
  searchLabel: string;
  listLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const ids = useId();

  const recorded = items.filter((i) => i.hasAudio).length;
  const q = normalize(query);
  const visible = items.filter((i) =>
    i.key === pinnedKey ||
    ((filter === "all" || (filter === "recorded") === i.hasAudio) && (!q || normalize(i.search).includes(q))),
  );
  const filtered = q !== "" || filter !== "all";

  const options: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Tous", count: items.length },
    { value: "recorded", label: "Enregistrés", count: recorded },
    { value: "missing", label: "Manquants", count: items.length - recorded },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
          <label htmlFor={`${ids}-q`} className="text-sm font-semibold">{searchLabel}</label>
          <div className="relative">
            <Search size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ms-muted" />
            <input id={`${ids}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="ms-field pl-10" autoComplete="off" />
          </div>
        </div>
        <div role="group" aria-label="Filtrer par état d'enregistrement" className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button key={o.value} variant={filter === o.value ? "primary" : "secondary"} aria-pressed={filter === o.value} onClick={() => setFilter(o.value)}>
              {o.label} <span className="tabular-nums">{o.count}</span>
            </Button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{visible.length} {visible.length > 1 ? "résultats" : "résultat"}</p>

      <div className="ms-panel overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            title="Aucun résultat"
            text={filter === "missing" && !q ? "Tout est enregistré dans cette liste." : "Modifiez la recherche ou le filtre."}
            action={filtered ? <Button variant="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Effacer les filtres</Button> : undefined}
          />
        ) : (
          <ul aria-label={listLabel} className="divide-y divide-ms-line">
            {visible.map((item) => renderRow(item))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Conseils d'enregistrement, repliés par défaut. */
export function RecordingTips({ children }: { children: ReactNode }) {
  return (
    <details className="group ms-panel">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[inherit] px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ms-blush-soft text-ms-blush-ink">
          <Lightbulb size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 font-semibold">Conseils pour un bon enregistrement</span>
        <ChevronDown size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="flex-shrink-0 -rotate-90 text-ms-muted transition-transform duration-[180ms] group-open:rotate-0" />
      </summary>
      <ul className="list-disc space-y-1.5 px-4 pb-4 pl-9 text-sm sm:px-5 sm:pl-10 marker:text-ms-muted">{children}</ul>
    </details>
  );
}

/** Progression d'une liste : « n sur total enregistrés » et une barre discrète. */
export function RecordedProgress({ recorded, total, tone = "sage" }: { recorded: number; total: number; tone?: "sage" | "slate" | "blush" }) {
  const pct = total ? Math.round((recorded / total) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-[0_1_18rem] flex-col gap-1.5">
      <p className="text-sm tabular-nums"><span className="font-semibold">{recorded} sur {total}</span> <span className="text-ms-muted">enregistrés</span></p>
      <div className="h-2 overflow-hidden rounded-full bg-ms-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={recorded} aria-label="Enregistrements faits">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--ms-${tone})` }} />
      </div>
    </div>
  );
}
