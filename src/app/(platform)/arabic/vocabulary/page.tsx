"use client";
import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Volume2, ChevronRight, Star } from "lucide-react";
import { VOCAB_THEMES, ArabicWord, VocabTheme } from "@/data/arabicVocabulary";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(words: ArabicWord[]) {
  const pool = shuffle(words);
  const target = pool[0];
  const choices = shuffle([target, ...pool.slice(1, 3)]);
  return { target, choices };
}

type Phase = "themes" | "exercise";

export default function VocabularyPage() {
  const [phase, setPhase] = useState<Phase>("themes");
  const [theme, setTheme] = useState<VocabTheme | null>(null);
  const [round, setRound] = useState<{ target: ArabicWord; choices: ArabicWord[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startTheme = useCallback((t: VocabTheme) => {
    setTheme(t);
    setRound(buildRound(t.words));
    setSelected(null);
    setScore(0);
    setTotal(0);
    setPhase("exercise");
  }, []);

  const playAudio = useCallback(() => {
    if (!theme || !round) return;
    const key = `ms_arabic_audio_${theme.id}_${round.target.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    audioRef.current?.pause();
    const audio = new Audio(stored);
    audioRef.current = audio;
    audio.play();
  }, [theme, round]);

  const handleSelect = useCallback((word: ArabicWord) => {
    if (selected || !round) return;
    setSelected(word.id);
    setTotal((t) => t + 1);
    if (word.id === round.target.id) setScore((s) => s + 1);
  }, [selected, round]);

  const next = useCallback(() => {
    if (!theme) return;
    setSelected(null);
    setRound(buildRound(theme.words));
  }, [theme]);

  /* ── Theme selection ── */
  if (phase === "themes") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fff8ee] via-[#fffef9] to-[#f0faf5]">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <Link href="/arabic" className="flex items-center gap-2 text-gray-500 hover:text-[#f9a875] transition-colors">
            <ArrowLeft size={18} /> Retour
          </Link>
          <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
            المُفْرَدَات — Vocabulaire
          </span>
          <div className="w-24" />
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="text-center mb-10">
            <div className="text-5xl mb-3">📖</div>
            <h1 className="text-3xl font-black text-[#2d2d2d] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Choisis un thème
            </h1>
            <p className="text-[#8b6f47] font-semibold">Niveau 1 — Exercice «&nbsp;Où est… ?&nbsp;»</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {VOCAB_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => startTheme(t)}
                className="montessori-card p-5 text-center hover:scale-105 transition-transform"
                style={{ background: t.bg, border: `2px solid ${t.color}40` }}
              >
                <div className="text-4xl mb-2">{t.emoji}</div>
                <p
                  className="text-xs font-bold text-gray-500 mb-1"
                  style={{ fontFamily: "'Cairo', sans-serif", direction: "rtl" }}
                >
                  {t.nameArabic}
                </p>
                <p className="font-bold text-[#2d2d2d] text-sm">{t.nameFrench}</p>
                <p className="text-xs text-gray-400 mt-1">{t.words.length} mots</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Exercise ── */
  if (!round || !theme) return null;
  const { target, choices } = round;
  const isCorrect = selected === target.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff8ee] via-[#fffef9] to-[#f0faf5]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => setPhase("themes")}
          className="flex items-center gap-2 text-gray-500 hover:text-[#f9a875] transition-colors"
        >
          <ArrowLeft size={18} /> Thèmes
        </button>
        <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          {theme.emoji} {theme.nameFrench}
        </span>
        <div className="flex items-center gap-1 text-sm font-bold text-[#f9a875]">
          <Star size={14} fill="#f9a875" /> {score}/{total}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Question */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-8 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Question</p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <h2
              className="text-4xl font-black text-[#2d2d2d] leading-normal"
              style={{ fontFamily: "'Cairo', sans-serif", direction: "rtl" }}
            >
              أَيْنَ {target.arabic}؟
            </h2>
            <button
              onClick={playAudio}
              className="w-11 h-11 rounded-full bg-[#f9a875]/10 hover:bg-[#f9a875]/20 flex items-center justify-center transition-colors shrink-0"
              title="Écouter la question"
            >
              <Volume2 size={20} className="text-[#f9a875]" />
            </button>
          </div>
          <p className="text-[#8b6f47] font-semibold text-lg">
            Où est {target.french}&nbsp;?
          </p>
        </div>

        {/* 3 choices — horizontally */}
        <div className="flex gap-4">
          {choices.map((word) => {
            const isThis = selected === word.id;
            const isAnswer = word.id === target.id;
            let border = "border-gray-100";
            let bg = "bg-white";
            if (isThis && isAnswer) { border = "border-[#95d5b2]"; bg = "bg-[#f0faf5]"; }
            else if (isThis && !isAnswer) { border = "border-[#ff8fa3]"; bg = "bg-[#fff0f3]"; }
            else if (selected && isAnswer) { border = "border-[#95d5b2]"; bg = "bg-[#f0faf5]"; }

            return (
              <button
                key={word.id}
                onClick={() => handleSelect(word)}
                disabled={!!selected}
                className={`${bg} border-2 ${border} rounded-3xl flex-1 py-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all disabled:hover:translate-y-0 disabled:cursor-default`}
              >
                <span className="text-6xl select-none">{word.emoji}</span>
                {selected && (
                  <span
                    className="text-sm font-bold text-[#2d2d2d] px-2 text-center"
                    style={{ fontFamily: "'Cairo', sans-serif" }}
                  >
                    {word.arabic}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {selected && (
          <div className="mt-8 text-center animate-bounce-in">
            {isCorrect ? (
              <div>
                <div className="text-5xl mb-2">🌟</div>
                <p className="text-2xl font-black text-[#95d5b2]">Bravo !</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-sm mb-2">C'était…</p>
                <p
                  className="text-2xl font-black text-[#2d2d2d]"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                >
                  {target.arabic} <span className="text-3xl">{target.emoji}</span>
                </p>
                <p className="text-[#8b6f47] font-semibold">{target.french}</p>
              </div>
            )}
            <button
              onClick={next}
              className="mt-5 inline-flex items-center gap-2 px-7 py-3 bg-[#BB908E] text-white rounded-full font-bold shadow hover:bg-[#a87e7c] hover:shadow-lg hover:scale-105 transition-all"
            >
              Question suivante <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
