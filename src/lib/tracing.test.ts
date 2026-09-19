import { describe, it, expect } from "vitest";
import {
  INITIAL_PROGRESS, advance, buildGuide, canStart, hint, isComplete, samplePath, strokeFraction, strokesDone, tapMark,
  type Pt, type TraceGuide, type TraceProgress,
} from "./tracing";
import { LETTER_STROKES } from "@/data/letterStrokes";

/** Trace parfaitement tous les traits restants, comme le ferait un doigt qui suit le modèle. */
function traceAll(guide: TraceGuide, from: TraceProgress = INITIAL_PROGRESS): TraceProgress {
  let progress = from;
  for (const points of guide.strokes.slice(progress.stroke)) {
    expect(canStart(guide, progress, points[0])).toBe(true);
    for (const p of points) progress = advance(guide, progress, p).progress;
  }
  return progress;
}

describe("samplePath", () => {
  it("jalonne un segment à pas régulier, extrémités comprises", () => {
    const points = samplePath("M0 0L100 0", 25);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 100, y: 0 });
    expect(points).toHaveLength(5);
  });

  it("suit une courbe quadratique", () => {
    const points = samplePath("M0 0Q50 100 100 0", 20);
    const top = Math.max(...points.map((p) => p.y));
    expect(top).toBeGreaterThan(40);
    expect(top).toBeLessThanOrEqual(50);
  });
});

describe("tracé d'une lettre", () => {
  const line: TraceGuide = { strokes: [samplePath("M100 100L900 100")], marks: [{ cx: 500, cy: 400, r: 30 }] };

  it("exige de partir du début du trait, pas de la fin", () => {
    expect(canStart(line, INITIAL_PROGRESS, { x: 120, y: 110 })).toBe(true);
    expect(canStart(line, INITIAL_PROGRESS, { x: 900, y: 100 })).toBe(false);
  });

  it("ne valide pas un trait parcouru à l'envers", () => {
    let progress = INITIAL_PROGRESS;
    for (let x = 900; x >= 300; x -= 20) progress = advance(line, progress, { x, y: 100 }).progress;
    expect(strokesDone(line, progress)).toBe(false);
    expect(progress.checkpoint).toBe(0);
  });

  it("tolère un tracé tremblé et colore la lettre au fil du geste", () => {
    let progress = INITIAL_PROGRESS;
    for (let x = 100; x <= 500; x += 20) progress = advance(line, progress, { x, y: 100 + (x % 40 ? 45 : -45) }).progress;
    const half = strokeFraction(line, progress, 0);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.75);
  });

  it("signale un doigt qui quitte la lettre, sans faire avancer le tracé", () => {
    const result = advance(line, INITIAL_PROGRESS, { x: 300, y: 500 });
    expect(result.offTrack).toBe(true);
    expect(result.progress).toBe(INITIAL_PROGRESS);
  });

  it("permet de lever le doigt et de reprendre là où l'on s'est arrêté", () => {
    let progress = INITIAL_PROGRESS;
    for (let x = 100; x <= 500; x += 20) progress = advance(line, progress, { x, y: 100 }).progress;
    const resume = hint(line, progress);
    expect(resume && canStart(line, progress, resume.at)).toBe(true);
    expect(canStart(line, progress, { x: 100, y: 100 })).toBe(false);
  });

  it("ne pose les points qu'après les traits", () => {
    const dot: Pt = { x: 510, y: 410 };
    expect(tapMark(line, INITIAL_PROGRESS, dot)).toBe(INITIAL_PROGRESS);

    const traced = traceAll(line);
    expect(isComplete(line, traced)).toBe(false);
    expect(tapMark(line, traced, { x: 100, y: 800 })).toBe(traced);
    expect(isComplete(line, tapMark(line, traced, dot))).toBe(true);
  });
});

describe("les 28 lettres", () => {
  it("se valident toutes quand on suit leur modèle, traits puis points", () => {
    expect(Object.keys(LETTER_STROKES)).toHaveLength(28);
    for (const [char, glyph] of Object.entries(LETTER_STROKES)) {
      const guide = buildGuide(glyph);
      let progress = traceAll(guide);
      expect(strokesDone(guide, progress), char).toBe(true);
      for (const mark of guide.marks) progress = tapMark(guide, progress, { x: mark.cx, y: mark.cy });
      expect(isComplete(guide, progress), char).toBe(true);
    }
  });

  it("refusent un départ à l'autre bout du premier trait", () => {
    for (const [char, glyph] of Object.entries(LETTER_STROKES)) {
      const guide = buildGuide(glyph);
      const first = guide.strokes[0];
      const end = first[first.length - 1];
      // Les boucles fermées (ه) finissent près de leur départ : elles sont hors de ce contrôle.
      if (Math.hypot(end.x - first[0].x, end.y - first[0].y) < 200) continue;
      expect(canStart(guide, INITIAL_PROGRESS, end), char).toBe(false);
    }
  });
});
