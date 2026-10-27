import { MonitorPlay, RotateCcw } from "lucide-react";
import type { ApiLesson } from "@/lib/api/lessons";
import { StatusPill } from "@/components/platform/ui";

/**
 * État du diaporama du cours en direct d'une leçon, d'après le drapeau calculé
 * par le serveur (`liveStale`) : prêt, à mettre à jour, ou absent. Le cours en
 * direct projette ce diaporama ; les élèves, eux, voient la leçon elle-même.
 */
export function DeckStatusPill({ lesson }: { lesson: Pick<ApiLesson, "live" | "liveStale"> }) {
  if (lesson.liveStale === true) {
    return <StatusPill state="review" icon={RotateCcw}>Diaporama à mettre à jour</StatusPill>;
  }
  if (lesson.liveStale === false || lesson.live) {
    return <StatusPill state="success" icon={MonitorPlay}>Diaporama prêt</StatusPill>;
  }
  return <StatusPill state="outline">Pas de diaporama</StatusPill>;
}
