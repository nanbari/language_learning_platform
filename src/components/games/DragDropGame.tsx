"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";

interface Item { id: string; text: string; correctCategory: string; emoji?: string; }
interface Category { id: string; label: string; color: string; emoji?: string; }
interface Props { items: Item[]; categories: Category[]; onComplete: () => void; }

export default function DragDropGame({ items, categories, onComplete }: Props) {
  const { addPoints } = useGameStore();
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const unplaced = items.filter((i) => !placements[i.id]);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData("itemId", itemId);
  };

  const handleDrop = (e: React.DragEvent, catId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    if (itemId) {
      setPlacements((prev) => ({ ...prev, [itemId]: catId }));
      setDragOver(null);
    }
  };

  const handleCheck = () => {
    const r: Record<string, boolean> = {};
    let pts = 0;
    items.forEach((item) => {
      const correct = placements[item.id] === item.correctCategory;
      r[item.id] = correct;
      if (correct) pts += 12;
    });
    setResults(r);
    setChecked(true);
    addPoints(pts);
    if (Object.values(r).every(Boolean)) setTimeout(onComplete, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-[#2d2d2d]">Trie les éléments 🗂️</h2>
        <p className="text-gray-500 text-sm mt-1">Glisse chaque carte vers la bonne catégorie</p>
      </div>

      {/* Unplaced items */}
      {unplaced.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mb-8 p-4 bg-[#fffef9] rounded-2xl border border-dashed border-gray-200 min-h-[80px]">
          {unplaced.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              className="px-4 py-2 bg-white rounded-xl border-2 border-gray-200 font-semibold text-[#2d2d2d] cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md hover:scale-105 transition-all select-none"
            >
              {item.emoji} {item.text}
            </div>
          ))}
        </div>
      )}

      {/* Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {categories.map((cat) => {
          const placed = items.filter((i) => placements[i.id] === cat.id);
          return (
            <div
              key={cat.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(cat.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, cat.id)}
              className={cn("min-h-[140px] rounded-2xl border-2 p-4 transition-all", dragOver === cat.id ? "drag-over" : "")}
              style={{ borderColor: `${cat.color}40`, background: `${cat.color}08` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: cat.color }}>
                  {cat.emoji || cat.label[0]}
                </div>
                <span className="font-black text-[#2d2d2d]">{cat.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {placed.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-sm font-semibold cursor-grab select-none border-2 transition-all",
                      checked && results[item.id] ? "bg-[#f0faf5] border-[#95d5b2] text-[#2d2d2d]" :
                      checked && !results[item.id] ? "bg-[#fff0f3] border-[#ff8fa3] text-[#2d2d2d]" :
                      "bg-white border-gray-200 text-[#2d2d2d]"
                    )}
                  >
                    {checked && (results[item.id] ? "✓ " : "✗ ")}{item.emoji} {item.text}
                  </div>
                ))}
                {placed.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Dépose ici...</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unplaced.length === 0 && !checked && (
        <button onClick={handleCheck} className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#95d5b2] to-[#74c2e8] text-white font-black text-lg hover:shadow-lg hover:scale-[1.02] transition-all">
          Vérifier mes réponses ✓
        </button>
      )}

      {checked && (
        <div className={cn("mt-4 p-5 rounded-2xl text-center animate-bounce-in",
          Object.values(results).every(Boolean) ? "bg-[#f0faf5] border border-[#95d5b2]" : "bg-[#fff8ee] border border-[#ffd166]"
        )}>
          <p className="font-black text-xl mb-1">
            {Object.values(results).every(Boolean) ? "🏆 Parfait !" : `${Object.values(results).filter(Boolean).length}/${items.length} corrects`}
          </p>
          <button onClick={() => { setPlacements({}); setChecked(false); setResults({}); }}
            className="mt-3 px-5 py-2 rounded-full bg-[#6B705C] text-white font-bold hover:bg-[#5b6050] hover:shadow-md transition-all">
            Recommencer
          </button>
        </div>
      )}
    </div>
  );
}
