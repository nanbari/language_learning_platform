"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { CODE_LENGTH, normalizeCode, type Participant } from "@/lib/liveSession";
import { useLiveGuest } from "@/lib/useLiveSession";
import { SlideView } from "@/components/present/Slides";

export default function StudentLivePage() {
  const { user } = useAuthStore();
  const [code, setCode] = useState<string | null>(null);

  if (code && user) {
    return <LiveRoom code={code} me={{ id: user.id, name: user.name }} onLeave={() => setCode(null)} />;
  }
  return <JoinForm onJoin={setCode} />;
}

function JoinForm({ onJoin }: { onJoin: (code: string) => void }) {
  const [input, setInput] = useState("");
  const ready = input.length === CODE_LENGTH;

  return (
    <div className="min-h-screen bg-[#F5EEE8] flex flex-col">
      <div className="px-4 py-3">
        <Link href="/student" className="inline-flex items-center gap-2 text-[#2D2D2D]/50 hover:text-[#BB908E] font-semibold transition-colors">
          <ArrowLeft size={18} /> Mon espace
        </Link>
      </div>
      <form
        className="flex-1 flex flex-col items-center justify-center px-4 pb-24 text-center"
        onSubmit={(e) => { e.preventDefault(); if (ready) onJoin(input); }}
      >
        <span className="text-7xl animate-float mb-4">🎬</span>
        <h1 className="text-3xl text-[#2D2D2D] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Cours en direct
        </h1>
        <p className="text-[#2D2D2D]/60 font-semibold mb-6">Écris le code donné par ton enseignant</p>
        <input
          value={input}
          onChange={(e) => setInput(normalizeCode(e.target.value))}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="0000"
          aria-label="Code de la séance"
          className="w-56 text-center text-5xl font-black tracking-[0.3em] pl-[0.3em] py-3 rounded-2xl bg-[#FFFDF8] border-4 border-[#EDE5D8] focus:border-[#BB908E] outline-none text-[#2D2D2D] placeholder:text-[#2D2D2D]/15 mb-6"
        />
        <button
          type="submit"
          disabled={!ready}
          className="px-8 py-3 rounded-full font-bold text-lg text-white shadow hover:shadow-md hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100"
          style={{ background: "#BB908E" }}
        >
          Rejoindre
        </button>
      </form>
    </div>
  );
}

function Waiting({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="text-[20vmin] leading-none animate-float mb-[3vmin]">{emoji}</div>
      <h1 className="text-[7vmin] text-[#2D2D2D]" style={{ fontFamily: "'Fredoka One', cursive" }}>{title}</h1>
      <p className="text-[3.4vmin] font-bold text-[#2D2D2D]/50">{text}</p>
    </div>
  );
}

function LiveRoom({ code, me, onLeave }: { code: string; me: Participant; onLeave: () => void }) {
  const { state, status, sendAnswer } = useLiveGuest(code, me);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5EEE8] overflow-hidden select-none">
      <div className="flex items-center justify-between px-4 py-2 text-sm font-bold text-[#2D2D2D]/50">
        <button onClick={onLeave} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:text-red-400 hover:bg-red-50 transition-colors">
          <X size={16} /> Quitter
        </button>
        {status === "live" && state && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: state.total }, (_, i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all"
                style={{ width: i === state.index ? 22 : 8, background: i <= state.index ? "#BB908E" : "#CCB9B5" + "60" }}
              />
            ))}
          </div>
        )}
        <span>{me.name}</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        {status === "ended" ? (
          <Waiting emoji="👋" title="Le cours est terminé" text="À bientôt !" />
        ) : status !== "live" || !state ? (
          <Waiting
            emoji="⏳"
            title={status === "connecting" ? "Connexion…" : "On attend ton enseignant"}
            text={`Code ${code} — le cours va bientôt commencer`}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={state.index}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <SlideView
                slide={state.slide}
                step={state.step}
                game={{
                  revealed: state.revealed,
                  onPick: (choiceId, correct) => sendAnswer(state.index, choiceId, correct),
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
