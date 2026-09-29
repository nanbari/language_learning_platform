import type { LetterStrokes, PenMark } from "@/data/letterStrokes";

/**
 * Vérification d'un tracé d'élève contre le geste de référence d'une lettre
 * (repère 1000 × 1000 de `letterStrokes`). On exige le bon point de départ,
 * le bon sens et le bon ordre des traits — pas la précision du trait : les
 * tolérances sont larges, un enfant qui tremble doit réussir.
 *
 * Chaque trait est jalonné de repères à franchir dans l'ordre ; les points de
 * la lettre se posent ensuite, d'un simple appui, dans n'importe quel ordre.
 */

export interface Pt { x: number; y: number }

export interface TraceGuide {
  strokes: Pt[][];
  marks: PenMark[];
}

export interface TraceProgress {
  /** Trait en cours (égal au nombre de traits une fois tous tracés). */
  stroke: number;
  /** Prochain repère à franchir sur ce trait. */
  checkpoint: number;
  /** Indices des points déjà posés. */
  marksDone: number[];
}

export const SPACING = 40;
/** Distance maximale au point de départ (ou de reprise) pour poser le doigt. */
export const START_TOLERANCE = 130;
/** Distance à laquelle un repère est considéré comme franchi. */
export const HIT_TOLERANCE = 100;
/** Au-delà, le doigt a quitté la lettre : le geste en cours est annulé. */
export const OFF_TOLERANCE = 170;
/** Marge autour d'un point de la lettre pour l'appui. */
export const MARK_TOLERANCE = 70;

export const INITIAL_PROGRESS: TraceProgress = { stroke: 0, checkpoint: 0, marksDone: [] };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Échantillonne un chemin SVG fait de M, L et Q (celui de `letterStrokes`) à pas régulier. */
export function samplePath(d: string, spacing = SPACING): Pt[] {
  const fine: Pt[] = [];
  let pos: Pt = { x: 0, y: 0 };
  for (const [, cmd, args] of d.matchAll(/([MLQ])([^MLQ]*)/g)) {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === "M") {
      pos = { x: n[0], y: n[1] };
      fine.push(pos);
    } else if (cmd === "L") {
      const end = { x: n[0], y: n[1] };
      const steps = Math.max(1, Math.ceil(dist(pos, end) / 4));
      for (let i = 1; i <= steps; i++) {
        fine.push({ x: pos.x + ((end.x - pos.x) * i) / steps, y: pos.y + ((end.y - pos.y) * i) / steps });
      }
      pos = end;
    } else {
      const ctrl = { x: n[0], y: n[1] };
      const end = { x: n[2], y: n[3] };
      const steps = Math.max(2, Math.ceil((dist(pos, ctrl) + dist(ctrl, end)) / 4));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fine.push({
          x: (1 - t) ** 2 * pos.x + 2 * (1 - t) * t * ctrl.x + t ** 2 * end.x,
          y: (1 - t) ** 2 * pos.y + 2 * (1 - t) * t * ctrl.y + t ** 2 * end.y,
        });
      }
      pos = end;
    }
  }
  if (fine.length === 0) return [];

  const out: Pt[] = [fine[0]];
  let travelled = 0;
  for (let i = 1; i < fine.length; i++) {
    travelled += dist(fine[i - 1], fine[i]);
    if (travelled >= spacing) {
      out.push(fine[i]);
      travelled = 0;
    }
  }
  const last = fine[fine.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function buildGuide(glyph: LetterStrokes): TraceGuide {
  return { strokes: glyph.strokes.map((s) => samplePath(s.d)), marks: glyph.marks };
}

export function strokesDone(guide: TraceGuide, progress: TraceProgress): boolean {
  return progress.stroke >= guide.strokes.length;
}

export function isComplete(guide: TraceGuide, progress: TraceProgress): boolean {
  return strokesDone(guide, progress) && progress.marksDone.length >= guide.marks.length;
}

/** Part tracée du trait `index`, entre 0 et 1 (pour colorer la lettre au fil du geste). */
export function strokeFraction(guide: TraceGuide, progress: TraceProgress, index: number): number {
  if (index < progress.stroke) return 1;
  if (index > progress.stroke) return 0;
  return progress.checkpoint / guide.strokes[index].length;
}

/** Où poser le doigt, et vers où partir : départ du trait, ou reprise là où l'élève s'est arrêté. */
export function hint(guide: TraceGuide, progress: TraceProgress): { at: Pt; toward: Pt } | null {
  if (strokesDone(guide, progress)) return null;
  const points = guide.strokes[progress.stroke];
  const i = Math.max(0, progress.checkpoint - 1);
  return { at: points[i], toward: points[Math.min(points.length - 1, i + 2)] };
}

/** Le doigt se pose-t-il au bon endroit pour (re)commencer le trait en cours ? */
export function canStart(guide: TraceGuide, progress: TraceProgress, p: Pt): boolean {
  const spot = hint(guide, progress);
  return !!spot && dist(p, spot.at) <= START_TOLERANCE;
}

/** Fait avancer le trait en cours ; `offTrack` signale que le doigt a quitté la lettre. */
export function advance(guide: TraceGuide, progress: TraceProgress, p: Pt): { progress: TraceProgress; offTrack: boolean } {
  if (strokesDone(guide, progress)) return { progress, offTrack: false };
  const points = guide.strokes[progress.stroke];

  let nearest = Infinity;
  for (const q of points) nearest = Math.min(nearest, dist(p, q));
  if (nearest > OFF_TOLERANCE) return { progress, offTrack: true };

  let checkpoint = progress.checkpoint;
  while (checkpoint < points.length && dist(p, points[checkpoint]) <= HIT_TOLERANCE) checkpoint++;
  if (checkpoint === progress.checkpoint) return { progress, offTrack: false };

  const next = checkpoint >= points.length
    ? { ...progress, stroke: progress.stroke + 1, checkpoint: 0 }
    : { ...progress, checkpoint };
  return { progress: next, offTrack: false };
}

/** Appui pour poser un point de la lettre, une fois tous les traits tracés. */
export function tapMark(guide: TraceGuide, progress: TraceProgress, p: Pt): TraceProgress {
  if (!strokesDone(guide, progress)) return progress;
  const index = guide.marks.findIndex(
    (m, i) => !progress.marksDone.includes(i) && dist(p, { x: m.cx, y: m.cy }) <= m.r + MARK_TOLERANCE,
  );
  return index < 0 ? progress : { ...progress, marksDone: [...progress.marksDone, index] };
}
