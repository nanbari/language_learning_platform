"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { LetterGlyph, LetterTracing } from "@/components/present/LetterTracing";
import type { Slide } from "@/lib/presentation";
import type { ArabicLetter } from "@/data/arabicAlphabet";
import type { ArabicWord } from "@/data/arabicVocabulary";

// Naskh : le style des cahiers d'école, cohérent avec le tracé animé des lettres.
const ARABIC_FONT = { fontFamily: "'Noto Naskh Arabic', 'Cairo', serif", direction: "rtl" as const };
const CONFETTI_COLORS = ["#BB908E", "#CCB9B5", "#8BA3B1", "#6B705C", "#999B84", "#7B868E"];
/** Fond de la bonne réponse : sauge de la charte, éclaircie. */
const SOLVED_BG = "#999B8466";

/** Pluie de confettis ; positions dérivées de l'indice pour rester pur au rendu. */
export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden>
      {Array.from({ length: 60 }, (_, i) => {
        const left = (i * 37) % 100;
        const size = 8 + ((i * 13) % 10);
        return (
          <motion.span
            key={i}
            className="absolute top-0 block"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 1.6,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              borderRadius: i % 3 === 0 ? "50%" : 2,
            }}
            initial={{ y: "-10vh", rotate: 0, opacity: 1 }}
            animate={{ y: "110vh", rotate: 360 + ((i * 53) % 360), x: ((i * 29) % 120) - 60, opacity: [1, 1, 0.8, 0] }}
            transition={{ duration: 2.2 + ((i * 7) % 12) / 10, delay: ((i * 11) % 8) / 10, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}

function WordLabel({ word, color }: { word: ArabicWord; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <p className="text-[13vmin] leading-tight font-black" style={{ ...ARABIC_FONT, color }}>{word.arabic}</p>
    </motion.div>
  );
}

function TitleSlide({ slide }: { slide: Extract<Slide, { kind: "title" }> }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 12 }}
        className="text-[22vmin] leading-none mb-[3vmin] font-black"
        style={{ ...ARABIC_FONT, color: slide.color }}
      >
        {slide.emoji}
      </motion.div>
      {slide.arabic && (
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-[10vmin] font-black"
          style={{ ...ARABIC_FONT, color: slide.color }}
        >
          {slide.arabic}
        </motion.p>
      )}
    </div>
  );
}

/** Les lettres du jour entrent une à une, de droite à gauche comme on les lit. */
function LettersTitleSlide({ letters, step }: { letters: ArabicLetter[]; step: number }) {
  return (
    <div className="flex justify-center gap-[5vmin]" dir="rtl">
      {letters.map((letter, i) => (
        <div key={letter.id} className="w-[28vmin] h-[40vmin] flex items-center justify-center">
          {i <= step && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 12 }}
              style={{ color: letter.color }}
            >
              <LetterGlyph char={letter.isolated} className="w-[28vmin] h-[28vmin]" />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}

/** La lettre s'écrit sous les yeux des élèves, dans l'ordre et le sens du geste. */
function LetterSlide({ letter, arabicName, step }: { letter: ArabicLetter; arabicName: boolean; step: number }) {
  const [replay, setReplay] = useState(0);
  return (
    <div className="text-center">
      <LetterTracing key={replay} char={letter.isolated} color={letter.color} className="h-[60vmin] w-[60vmin] mx-auto" />
      <div className="h-[14vmin]">
        {step >= 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {arabicName && (
              <p className="text-[9vmin] leading-tight font-black" style={{ ...ARABIC_FONT, color: letter.color }}>
                {letter.name}
              </p>
            )}
          </motion.div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setReplay((r) => r + 1); }}
        aria-label="Retracer la lettre"
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#FFFDF8] border border-[#EDE5D8] text-[#2D2D2D]/60 hover:text-[#BB908E] transition-colors"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

function FormsSlide({ letter, step }: { letter: ArabicLetter; step: number }) {
  // Ordre de lecture arabe : le début du mot est à droite.
  const forms = [
    { key: "final", glyph: letter.final, at: 3 },
    { key: "medial", glyph: letter.medial, at: 2 },
    { key: "initial", glyph: letter.initial, at: 1 },
  ];
  return (
    <div>
      <div className="flex items-stretch justify-center gap-[3vmin]">
        {forms.map((form) => (
          <div
            key={form.key}
            className="w-[26vmin] rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md flex flex-col items-center justify-center py-[3vmin]"
            style={{ borderColor: step >= form.at ? letter.color : "#EDE5D8" }}
          >
            <div className="h-[24vmin] flex items-center">
              {step >= form.at ? (
                <motion.span
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12 }}
                  className="text-[17vmin] leading-none font-black text-[#2D2D2D]"
                  style={ARABIC_FONT}
                >
                  {form.glyph}
                </motion.span>
              ) : (
                <span className="text-[12vmin] text-[#2D2D2D]/15 font-black">?</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExampleSlide({ slide }: { slide: Extract<Slide, { kind: "example" }> }) {
  const { letter, emoji } = slide;
  return (
    <div className="text-center">
      {emoji && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 12 }}
          className="text-[24vmin] leading-none mb-[2vmin]"
        >
          {emoji}
        </motion.div>
      )}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-[16vmin] leading-tight font-black"
        style={{ ...ARABIC_FONT, color: letter.color }}
      >
        {letter.example}
      </motion.p>
    </div>
  );
}

/**
 * Branchement des jeux sur la séance en direct. L'enseignant révèle la
 * solution à tous en cliquant la bonne réponse ; l'élève envoie ses essais.
 */
export interface GameProps {
  revealed?: boolean;
  onPick?: (choiceId: string, correct: boolean) => void;
  /** Premiers essais des élèves par choix, affichés une fois la solution révélée. */
  counts?: Record<string, number>;
}

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-[1.5vmin] -right-[1.5vmin] min-w-[6vmin] h-[6vmin] px-[1vmin] rounded-full bg-[#2D2D2D] text-white text-[3vmin] font-black flex items-center justify-center shadow"
      style={{ fontFamily: "'Nunito', sans-serif", direction: "ltr" }}
    >
      {count}
    </motion.span>
  );
}

function FindLetterSlide({ slide, game }: { slide: Extract<Slide, { kind: "findLetter" }>; game?: GameProps }) {
  const [wrong, setWrong] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const solved = found || game?.revealed === true;
  return (
    <div>
      <div className="grid grid-cols-3 gap-[2.5vmin] w-fit mx-auto">
        {slide.choices.map((letter) => {
          const isTarget = letter.id === slide.target.id;
          const isWrong = wrong.includes(letter.id);
          return (
            <motion.button
              key={letter.id}
              onClick={(e) => {
                e.stopPropagation();
                if (solved || isWrong) return;
                game?.onPick?.(String(letter.id), isTarget);
                if (isTarget) setFound(true);
                else setWrong((w) => [...w, letter.id]);
              }}
              animate={isWrong ? { x: [0, -10, 10, -6, 6, 0], opacity: 0.3 } : solved && isTarget ? { scale: [1, 1.2, 1.1] } : {}}
              whileHover={solved || isWrong ? undefined : { scale: 1.06 }}
              className="relative w-[28vmin] h-[28vmin] rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md text-[#2D2D2D] flex items-center justify-center"
              style={{ borderColor: solved && isTarget ? "#6B705C" : letter.color, background: solved && isTarget ? SOLVED_BG : undefined }}
            >
              <LetterGlyph char={letter.isolated} className="w-[22vmin] h-[22vmin]" />
              {solved && <CountBadge count={game?.counts?.[String(letter.id)]} />}
            </motion.button>
          );
        })}
      </div>
      {solved && <Confetti />}
    </div>
  );
}

function FlashcardSlide({ slide, step }: { slide: Extract<Slide, { kind: "flashcard" }>; step: number }) {
  const flipped = step >= 1;
  return (
    <div className="flex flex-col items-center" style={{ perspective: 1600 }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotateY: flipped ? 180 : 0 }}
        transition={{ rotateY: { duration: 0.7 }, default: { type: "spring", stiffness: 160, damping: 14 } }}
        className="relative w-[70vmin] h-[62vmin]"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute inset-0 rounded-[4vmin] bg-[#FFFDF8] border-[6px] shadow-xl flex flex-col items-center justify-center"
          style={{ borderColor: slide.color, backfaceVisibility: "hidden" }}
        >
          <span className="text-[30vmin] leading-none">{slide.word.emoji}</span>
        </div>
        <div
          className="absolute inset-0 rounded-[4vmin] border-[6px] shadow-xl flex flex-col items-center justify-center bg-[#FFFDF8]"
          style={{ borderColor: slide.color, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="text-[14vmin] leading-none mb-[1vmin]">{slide.word.emoji}</span>
          <p className="text-[15vmin] leading-tight font-black" style={{ ...ARABIC_FONT, color: slide.color }}>{slide.word.arabic}</p>
        </div>
      </motion.div>
    </div>
  );
}

const BLUR_LEVELS = [32, 16, 7, 0];

function BlurSlide({ slide, step }: { slide: Extract<Slide, { kind: "blur" }>; step: number }) {
  const revealed = step >= BLUR_LEVELS.length - 1;
  return (
    <div className="text-center">
      <motion.div
        animate={{ filter: `blur(${BLUR_LEVELS[Math.min(step, BLUR_LEVELS.length - 1)]}px)`, scale: revealed ? 1 : 1.5 }}
        transition={{ duration: 0.8 }}
        className="text-[30vmin] leading-none mb-[2vmin]"
      >
        {slide.word.emoji}
      </motion.div>
      <div className="h-[22vmin]">{revealed && <WordLabel word={slide.word} color={slide.color} />}</div>
      {revealed && <Confetti />}
    </div>
  );
}

function MissingSlide({ slide, step }: { slide: Extract<Slide, { kind: "missing" }>; step: number }) {
  const missing = slide.words.find((w) => w.id === slide.missingId);
  return (
    <div className="text-center">
      <div className="flex justify-center gap-[3vmin] mb-[3vmin]">
        {slide.words.map((word) => {
          const hidden = step === 1 && word.id === slide.missingId;
          const found = step >= 2 && word.id === slide.missingId;
          return (
            <motion.div
              key={word.id}
              animate={found ? { scale: [1, 1.25, 1.1] } : { scale: 1 }}
              className="w-[22vmin] h-[22vmin] rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md flex items-center justify-center text-[14vmin] leading-none"
              style={{ borderColor: found ? "#6B705C" : slide.color }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={hidden ? "hidden" : "shown"}
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ duration: 0.25 }}
                >
                  {hidden ? "❓" : word.emoji}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      <div className="h-[22vmin]">{step >= 2 && missing && <WordLabel word={missing} color={slide.color} />}</div>
      {step >= 2 && <Confetti />}
    </div>
  );
}

function QuizSlide({ slide, game }: { slide: Extract<Slide, { kind: "quiz" }>; game?: GameProps }) {
  const [wrong, setWrong] = useState<string[]>([]);
  const [found, setFound] = useState(false);
  const solved = found || game?.revealed === true;
  return (
    <div className="text-center">
      <p className="text-[12vmin] leading-tight font-black mb-[5vmin]" style={{ ...ARABIC_FONT, color: slide.color }}>
        أَيْنَ {slide.target.arabic}؟
      </p>
      <div className="flex justify-center gap-[3vmin]">
        {slide.choices.map((word) => {
          const isTarget = word.id === slide.target.id;
          const isWrong = wrong.includes(word.id);
          return (
            <motion.button
              key={word.id}
              onClick={(e) => {
                e.stopPropagation();
                if (solved || isWrong) return;
                game?.onPick?.(word.id, isTarget);
                if (isTarget) setFound(true);
                else setWrong((w) => [...w, word.id]);
              }}
              animate={isWrong ? { x: [0, -10, 10, -6, 6, 0], opacity: 0.3 } : solved && isTarget ? { scale: [1, 1.25, 1.12] } : {}}
              whileHover={solved || isWrong ? undefined : { scale: 1.06 }}
              className="relative w-[22vmin] h-[22vmin] rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md flex items-center justify-center text-[14vmin] leading-none"
              style={{ borderColor: solved && isTarget ? "#6B705C" : slide.color, background: solved && isTarget ? SOLVED_BG : undefined }}
            >
              {word.emoji}
              {solved && <CountBadge count={game?.counts?.[word.id]} />}
            </motion.button>
          );
        })}
      </div>
      {solved && <Confetti />}
    </div>
  );
}

function BravoSlide({ score, plain }: { score?: number; plain?: boolean }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: [0, -8, 8, -8, 0] }}
        transition={{ scale: { type: "spring", stiffness: 140, damping: 10 }, rotate: { delay: 0.6, duration: 1.2, repeat: Infinity, repeatDelay: 1.5 } }}
        className="text-[26vmin] leading-none mb-[2vmin]"
      >
        🏆
      </motion.div>
      {!plain && <p className="text-[12vmin] font-black text-[#BB908E]" style={ARABIC_FONT}>أَحْسَنْتُمْ</p>}
      {!!score && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-[8vmin] font-black text-[#6B705C]"
        >
          ⭐ {score}
        </motion.p>
      )}
      <Confetti />
    </div>
  );
}

export function SlideView({ slide, step, game, score }: { slide: Slide; step: number; game?: GameProps; score?: number }) {
  switch (slide.kind) {
    case "title": return <TitleSlide slide={slide} />;
    case "lettersTitle": return <LettersTitleSlide letters={slide.letters} step={step} />;
    case "letter": return <LetterSlide letter={slide.letter} arabicName={slide.arabicName} step={step} />;
    case "forms": return <FormsSlide letter={slide.letter} step={step} />;
    case "example": return <ExampleSlide slide={slide} />;
    case "findLetter": return <FindLetterSlide slide={slide} game={game} />;
    case "flashcard": return <FlashcardSlide slide={slide} step={step} />;
    case "blur": return <BlurSlide slide={slide} step={step} />;
    case "missing": return <MissingSlide slide={slide} step={step} />;
    case "quiz": return <QuizSlide slide={slide} game={game} />;
    case "bravo": return <BravoSlide score={score} plain={slide.plain} />;
  }
}
