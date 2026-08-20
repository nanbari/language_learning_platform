"use client";
import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";

export interface MatchSide { text?: string; imageDataUrl?: string; audioDataUrl?: string; }
interface RawPair { id: string; left: MatchSide | string; right: MatchSide | string; color?: string; }
interface Pair { id: string; left: MatchSide; right: MatchSide; color: string; }
interface Props { pairs: RawPair[]; onComplete: () => void; }

const COLORS = ["#f9a875", "#ffd166", "#95d5b2", "#74c2e8", "#c9b1e8", "#ff8fa3"];

function normalizeSide(side: MatchSide | string): MatchSide {
  return typeof side === "string" ? { text: side } : (side ?? {});
}

function SideContent({ side, color }: { side: MatchSide; color: string }) {
  const isEmpty = !side.text && !side.imageDataUrl && !side.audioDataUrl;
  if (isEmpty) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {side.imageDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.imageDataUrl} alt="" className="w-full max-h-24 object-cover rounded-xl" />
      )}
      {side.text && (
        <span className="text-sm font-bold text-[#2d2d2d] text-center leading-tight">{side.text}</span>
      )}
      {side.audioDataUrl && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); new Audio(side.audioDataUrl!).play(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors mt-0.5"
          style={{ background: `${color}25` }}
        >
          <Volume2 size={14} style={{ color }} />
        </button>
      )}
    </div>
  );
}

export default function MatchingGame({ pairs: rawPairs, onComplete }: Props) {
  const { addPoints } = useGameStore();
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [shuffledRight, setShuffledRight] = useState<Pair[]>([]);

  const pairs: Pair[] = rawPairs.map((p, i) => ({
    id: p.id,
    left: normalizeSide(p.left),
    right: normalizeSide(p.right),
    color: p.color ?? COLORS[i % COLORS.length],
  }));

  useEffect(() => {
    setShuffledRight([...pairs].sort(() => Math.random() - 0.5));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPairs]);

  const handleLeft = (id: string) => {
    if (matched.includes(id)) return;
    setSelectedLeft(id);
  };

  const handleRight = (id: string) => {
    if (!selectedLeft || matched.includes(id)) return;
    if (selectedLeft === id) {
      const next = [...matched, id];
      setMatched(next);
      addPoints(15);
      setSelectedLeft(null);
      if (next.length === pairs.length) setTimeout(onComplete, 600);
    } else {
      setWrongPair(id);
      setTimeout(() => { setWrongPair(null); setSelectedLeft(null); }, 700);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-[#2d2d2d]">Associe les paires 🔗</h2>
        <p className="text-gray-500 text-sm mt-1">{matched.length}/{pairs.length} paires trouvées</p>
      </div>

      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#95d5b2] to-[#74c2e8] transition-all duration-500"
          style={{ width: `${(matched.length / pairs.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 text-center uppercase tracking-wide">Colonne A</p>
          {pairs.map((p) => (
            <button
              key={p.id}
              onClick={() => handleLeft(p.id)}
              disabled={matched.includes(p.id)}
              className={cn(
                "w-full p-4 rounded-2xl border-2 text-left transition-all",
                matched.includes(p.id) ? "opacity-40 cursor-not-allowed border-transparent" : "",
                selectedLeft === p.id ? "scale-105 shadow-md" : "hover:scale-[1.02]",
              )}
              style={{
                borderColor: matched.includes(p.id) ? p.color : selectedLeft === p.id ? p.color : "#e5e7eb",
                background: matched.includes(p.id) ? `${p.color}15` : selectedLeft === p.id ? `${p.color}15` : "white",
              }}
            >
              {matched.includes(p.id) && (
                <span className="text-xs font-bold block mb-1" style={{ color: p.color }}>✓</span>
              )}
              <SideContent side={p.left} color={p.color} />
            </button>
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 text-center uppercase tracking-wide">Colonne B</p>
          {shuffledRight.map((p) => {
            const original = pairs.find((c) => c.id === p.id)!;
            return (
              <button
                key={p.id}
                onClick={() => handleRight(p.id)}
                disabled={matched.includes(p.id)}
                className={cn(
                  "w-full p-4 rounded-2xl border-2 text-left transition-all",
                  matched.includes(p.id) ? "opacity-40 cursor-not-allowed border-transparent" : "",
                  wrongPair === p.id ? "border-[#ff8fa3] bg-[#fff0f3] animate-wiggle" : "hover:scale-[1.02]",
                )}
                style={{
                  borderColor: matched.includes(p.id) ? original.color : wrongPair === p.id ? "#ff8fa3" : "#e5e7eb",
                  background: matched.includes(p.id) ? `${original.color}15` : "white",
                }}
              >
                {matched.includes(p.id) && (
                  <span className="text-xs font-bold block mb-1" style={{ color: original.color }}>✓</span>
                )}
                <SideContent side={p.right} color={original.color} />
              </button>
            );
          })}
        </div>
      </div>

      {matched.length === pairs.length && (
        <div className="mt-8 p-6 bg-[#f0faf5] rounded-2xl border border-[#95d5b2] text-center animate-bounce-in">
          <div className="text-4xl mb-2">🎊</div>
          <p className="font-black text-xl text-[#2d2d2d]">Parfait ! Toutes les paires trouvées !</p>
          <p className="text-[#95d5b2] font-semibold">+{pairs.length * 15} points gagnés</p>
        </div>
      )}
    </div>
  );
}
