"use client";
import { useId, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { LETTER_STROKES } from "@/data/letterStrokes";
import { LETTER_FORM_STROKES } from "@/data/letterFormStrokes";
import { LETTER_LINES } from "@/data/letterLines";
import {
  INITIAL_PROGRESS, advance, buildGuide, canStart, hint, isComplete, strokeFraction, strokesDone, tapMark,
  type Pt, type TraceProgress,
} from "@/lib/tracing";

/**
 * L'élève écrit la lettre au doigt, au stylet ou à la souris. Un rond qui
 * bat indique où poser le doigt et une flèche dans quel sens partir ; la
 * lettre se colore à mesure que le geste suit le bon chemin. Un départ au
 * mauvais endroit est ignoré ; un doigt qui quitte la lettre annule le geste
 * en cours, sans effacer ce qui était acquis.
 *
 * Le seul modèle affiché est le pointillé du chemin à suivre, posé sur les
 * lignes d'un cahier : ligne de base rouge, hauteur du corps en vert.
 */
export function LetterWriting({
  char, color, onDone, className,
}: { char: string; color: string; onDone?: () => void; className?: string }) {
  const maskId = `write-${useId().replace(/:/g, "")}`;
  // Lettre isolée, ou forme liée (« بـ », « ـبـ », « ـب »).
  const glyph = LETTER_STROKES[char] ?? LETTER_FORM_STROKES[char];
  const lines = LETTER_LINES[char];
  const model = useMemo(() => (glyph ? buildGuide(glyph) : null), [glyph]);

  const [progress, setProgress] = useState<TraceProgress>(INITIAL_PROGRESS);
  const [ink, setInk] = useState<Pt[][]>([]);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // Les gestionnaires lisent l'avancement ici : deux mouvements du doigt peuvent
  // arriver avant le rendu suivant, l'état React serait alors en retard d'un cran.
  const live = useRef<TraceProgress>(INITIAL_PROGRESS);
  // Geste en cours : l'état acquis au moment où le doigt s'est posé, pour y revenir.
  const drag = useRef<TraceProgress | null>(null);

  if (!glyph || !model) return null;
  const done = isComplete(model, progress);
  const spot = hint(model, progress);

  const toPoint = (e: React.PointerEvent): Pt => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * 1000, y: ((e.clientY - box.top) / box.height) * 1000 };
  };

  const commit = (next: TraceProgress) => {
    if (next === live.current) return;
    live.current = next;
    setProgress(next);
    if (isComplete(model, next)) onDone?.();
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const current = live.current;
    if (isComplete(model, current)) return;
    const p = toPoint(e);
    if (strokesDone(model, current)) {
      commit(tapMark(model, current, p));
      return;
    }
    if (!canStart(model, current, p)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = current;
    setDragging(true);
    setInk((lines) => [...lines, [p]]);
    commit(advance(model, current, p).progress);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toPoint(e);
    const current = live.current;
    const result = advance(model, current, p);
    if (result.offTrack) {
      commit(drag.current);
      setInk((lines) => lines.slice(0, -1));
      endDrag();
      return;
    }
    setInk((lines) => [...lines.slice(0, -1), [...lines[lines.length - 1], p]]);
    commit(result.progress);
    // Le trait est fini : le geste s'arrête là, le suivant repart de son propre départ.
    if (result.progress.stroke !== current.stroke) endDrag();
  };

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation();
    endDrag();
    live.current = INITIAL_PROGRESS;
    setProgress(INITIAL_PROGRESS);
    setInk([]);
  };

  const angle = spot ? (Math.atan2(spot.toward.y - spot.at.y, spot.toward.x - spot.at.x) * 180) / Math.PI : 0;
  const pendingMarks = strokesDone(model, progress)
    ? glyph.marks.filter((_, i) => !progress.marksDone.includes(i))
    : [];

  return (
    <div className="text-center" onClick={(e) => e.stopPropagation()}>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        className={className}
        style={{ touchAction: "none", cursor: done ? "default" : "crosshair" }}
        role="img"
        aria-label={char}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
            {glyph.strokes.map((s, i) => (
              <path
                key={i}
                d={s.d}
                fill="none"
                stroke="#fff"
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - strokeFraction(model, progress, i)}
              />
            ))}
            {glyph.marks.map((m, i) => progress.marksDone.includes(i) && <circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill="#fff" />)}
          </mask>
        </defs>

        {/* Surface d'écriture : capte le doigt partout dans le cadre */}
        <rect x="20" y="20" width="960" height="960" rx="60" fill="#FFFDF8" stroke="#EDE5D8" strokeWidth="6" />

        {/* Lignes du cahier : la lettre se pose sur la rouge, son corps monte jusqu'à la verte. */}
        {lines && (
          <g strokeWidth="5" strokeLinecap="round" opacity="0.4" pointerEvents="none">
            <line x1="60" x2="940" y1={lines.top} y2={lines.top} stroke="#5CB85C" />
            <line x1="60" x2="940" y1={lines.baseline} y2={lines.baseline} stroke="#D9534F" />
          </g>
        )}

        <g fill="none" stroke="#CCB9B5" strokeWidth="12" strokeLinecap="round" strokeDasharray="2 34">
          {glyph.strokes.map((s, i) => <path key={i} d={s.d} />)}
          {glyph.marks.map((m, i) => <circle key={i} cx={m.cx} cy={m.cy} r={m.r * 0.5} />)}
        </g>

        <path d={glyph.outline} fill={color} mask={`url(#${maskId})`} />

        {/* L'encre de l'élève s'efface une fois la lettre réussie : il ne reste que la belle lettre. */}
        {!done && ink.map((line, i) => (
          <polyline
            key={i}
            points={line.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#2D2D2D"
            strokeOpacity="0.45"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {spot && !dragging && (
          <g transform={`translate(${spot.at.x} ${spot.at.y})`} pointerEvents="none">
            <circle r="30" fill="#6B705C" fillOpacity="0.85">
              <animate attributeName="r" values="24;38;24" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <path d="M44 0L84 0M70 -16L88 0L70 16" transform={`rotate(${angle})`} fill="none" stroke="#6B705C" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {pendingMarks.map((m) => (
          <circle key={`${m.cx}-${m.cy}`} cx={m.cx} cy={m.cy} r={m.r} fill="none" stroke="#6B705C" strokeWidth="8" pointerEvents="none">
            <animate attributeName="r" values={`${m.r};${m.r + 16};${m.r}`} dur="1.2s" repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      <button
        onClick={reset}
        aria-label="Recommencer"
        className="mt-[1.5vmin] inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#FFFDF8] border border-[#EDE5D8] text-[#2D2D2D]/60 hover:text-[#BB908E] transition-colors"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
