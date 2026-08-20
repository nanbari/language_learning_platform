"use client";
import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";

interface Option { id: string; text: string; emoji?: string; }
interface Props {
  question: string;
  options: Option[];
  correctId: string;
  onNext: () => void;
  questionIndex: number;
  total: number;
}

export default function QuizGame({ question, options, correctId, onNext, questionIndex, total }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const { addPoints, setAnswer } = useGameStore();
  const answered = selected !== null;

  const handleSelect = (id: string) => {
    if (answered) return;
    setSelected(id);
    if (id === correctId) {
      addPoints(10);
      setAnswer("correct");
    } else {
      setAnswer("incorrect");
    }
  };

  const isCorrect = selected === correctId;

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#f9a875] to-[#ffd166] transition-all duration-500"
            style={{ width: `${((questionIndex) / total) * 100}%` }}
          />
        </div>
        <span className="text-sm font-bold text-gray-500">{questionIndex}/{total}</span>
      </div>

      {/* Question */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-6 text-center">
        <div className="text-4xl mb-4">🤔</div>
        <h2 className="text-xl font-black text-[#2d2d2d]">{question}</h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          const isRight = opt.id === correctId;
          let stateClass = "border-gray-200 bg-white hover:border-[#f9a875] hover:bg-[#fff8ee]";
          if (answered && isRight) stateClass = "border-[#95d5b2] bg-[#f0faf5] scale-[1.02]";
          else if (answered && isSelected && !isRight) stateClass = "border-[#ff8fa3] bg-[#fff0f3]";
          else if (answered) stateClass = "border-gray-100 bg-gray-50 opacity-60";

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 text-left font-semibold transition-all", stateClass, !answered && "cursor-pointer")}
            >
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 transition-colors",
                answered && isRight ? "bg-[#95d5b2] text-white" :
                answered && isSelected ? "bg-[#ff8fa3] text-white" :
                "bg-gray-100 text-gray-500"
              )}>
                {answered && isRight ? <CheckCircle size={16} /> : answered && isSelected && !isRight ? <XCircle size={16} /> : opt.emoji || "◦"}
              </div>
              <span className="text-[#2d2d2d]">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback + Next */}
      {answered && (
        <div className={cn("mt-6 p-4 rounded-2xl text-center animate-bounce-in", isCorrect ? "bg-[#f0faf5] border border-[#95d5b2]" : "bg-[#fff0f3] border border-[#ff8fa3]")}>
          <p className="font-black text-lg mb-1">{isCorrect ? "🎉 Bravo !" : "😅 Pas tout à fait..."}</p>
          <p className="text-sm text-gray-600">{isCorrect ? "+10 points !" : `La bonne réponse était : ${options.find((o) => o.id === correctId)?.text}`}</p>
          <button
            onClick={() => { setSelected(null); onNext(); }}
            className="mt-4 px-6 py-2 rounded-full bg-[#8BA3B1] text-white font-bold hover:bg-[#789dad] hover:shadow-md transition-all"
          >
            Question suivante →
          </button>
        </div>
      )}
    </div>
  );
}
