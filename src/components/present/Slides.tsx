"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, Volume2 } from "lucide-react";
import { LetterGlyph, LetterTracing } from "@/components/present/LetterTracing";
import { LetterWriting } from "@/components/present/LetterWriting";
import { isRightForm, writingGlyph, type Slide } from "@/lib/presentation";
import { joinedSegments } from "@/lib/arabicWord";
import { playLetterSound } from "@/lib/letterSound";
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
function LetterSlide({ letter }: { letter: ArabicLetter }) {
  const [replay, setReplay] = useState(0);
  return (
    <div className="text-center">
      <LetterTracing key={replay} char={letter.isolated} color={letter.color} className="h-[60vmin] w-[60vmin] mx-auto" />
      <button
        onClick={(e) => { e.stopPropagation(); setReplay((r) => r + 1); }}
        aria-label="Retracer la lettre"
        className="mt-[3vmin] inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#FFFDF8] border border-[#EDE5D8] text-[#2D2D2D]/60 hover:text-[#BB908E] transition-colors"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

function FormsSlide({ slide, step }: { slide: Extract<Slide, { kind: "forms" }>; step: number }) {
  const { letter, words } = slide;
  // Ordre de lecture arabe : le début du mot est à droite.
  const forms = [
    { key: "final", glyph: letter.final, word: words.final, at: 3 },
    { key: "medial", glyph: letter.medial, word: words.medial, at: 2 },
    { key: "initial", glyph: letter.initial, word: words.initial, at: 1 },
  ];
  return (
    <div className="flex items-start justify-center gap-[3vmin]">
      {forms.map((form) => {
        const shown = step >= form.at;
        const { before, target, after } = joinedSegments(form.word.text);
        return (
          <div key={form.key} className="w-[30vmin] flex flex-col items-center">
            <div
              className="w-full rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md flex flex-col items-center justify-center py-[3vmin]"
              style={{ borderColor: shown ? letter.color : "#EDE5D8" }}
            >
              <div className="h-[24vmin] flex items-center">
                {shown ? (
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
            {/* Le mot-exemple de cette position, révélé avec la forme ; hauteur réservée pour ne rien décaler. */}
            <div className="h-[30vmin] pt-[2vmin] text-center">
              {shown && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="text-[11vmin] leading-none mb-[1vmin]">{form.word.emoji}</div>
                  {/* Seule la lettre étudiée prend la couleur ; le reste du mot reste sombre. */}
                  <p className="text-[10vmin] leading-tight font-black text-[#2D2D2D] whitespace-nowrap" style={ARABIC_FONT}>
                    {before}
                    <span style={{ color: letter.color }}>{target}</span>
                    {after}
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
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

/** À l'élève d'écrire : la réussite est signalée à l'enseignant comme une bonne réponse. */
function WriteSlide({ slide, game }: { slide: Extract<Slide, { kind: "write" }>; game?: GameProps }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <LetterWriting
        key={writingGlyph(slide)}
        char={writingGlyph(slide)}
        color={slide.letter.color}
        onDone={() => { setDone(true); game?.onPick?.("done", true); }}
        className="h-[68vmin] w-[68vmin] mx-auto"
      />
      {done && <Confetti />}
    </div>
  );
}

/** Trois cartes de lettres isolées ; partagé par les deux jeux de lettres. */
function LetterChoices({
  target, choices, neutral, game,
}: { target: ArabicLetter; choices: ArabicLetter[]; neutral?: boolean; game?: GameProps }) {
  const [wrong, setWrong] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const solved = found || game?.revealed === true;
  return (
    <>
      <div className="grid grid-cols-3 gap-[2.5vmin] w-fit mx-auto">
        {choices.map((letter) => {
          const isTarget = letter.id === target.id;
          const isWrong = wrong.includes(letter.id);
          // `neutral` : la couleur d'une carte ne doit pas trahir la lettre colorée du mot.
          const border = neutral ? "#CCB9B5" : letter.color;
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
              style={{ borderColor: solved && isTarget ? "#6B705C" : border, background: solved && isTarget ? SOLVED_BG : undefined }}
            >
              <LetterGlyph char={letter.isolated} className="w-[22vmin] h-[22vmin]" />
              {solved && <CountBadge count={game?.counts?.[String(letter.id)]} />}
            </motion.button>
          );
        })}
      </div>
      {solved && <Confetti />}
    </>
  );
}

function FindLetterSlide({ slide, game }: { slide: Extract<Slide, { kind: "findLetter" }>; game?: GameProps }) {
  return (
    <div>
      <LetterChoices target={slide.target} choices={slide.choices} game={game} />
    </div>
  );
}

/**
 * Débutant, deuxième niveau : la lettre est montrée, trois sons sont proposés.
 * Toucher un haut-parleur fait entendre le son ; la coche en dessous le choisit.
 * Les cartes sont identiques : seule l'écoute permet de répondre.
 */
function PickSoundSlide({ slide, game }: { slide: Extract<Slide, { kind: "pickSound" }>; game?: GameProps }) {
  const [wrong, setWrong] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const solved = found || game?.revealed === true;
  const { target } = slide;
  return (
    <div className="text-center">
      <div
        className="w-[36vmin] h-[36vmin] mx-auto mb-[4vmin] rounded-[4vmin] bg-[#FFFDF8] border-4 shadow-md flex items-center justify-center"
        style={{ borderColor: target.color, color: target.color }}
      >
        <LetterGlyph char={target.isolated} className="w-[29vmin] h-[29vmin]" />
      </div>
      <div className="grid grid-cols-3 gap-[2.5vmin] w-fit mx-auto">
        {slide.choices.map((letter) => {
          const isTarget = letter.id === target.id;
          const isWrong = wrong.includes(letter.id);
          return (
            <motion.div
              key={letter.id}
              animate={isWrong ? { x: [0, -10, 10, -6, 6, 0], opacity: 0.3 } : solved && isTarget ? { scale: [1, 1.15, 1.08] } : {}}
              className="flex flex-col items-center gap-[1.5vmin]"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setPlaying(letter.id); playLetterSound(letter); }}
                aria-label="Écouter le son"
                className="relative w-[22vmin] h-[22vmin] rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md flex items-center justify-center transition-transform hover:scale-105"
                style={{
                  borderColor: solved && isTarget ? "#6B705C" : playing === letter.id ? "#8BA3B1" : "#CCB9B5",
                  background: solved && isTarget ? SOLVED_BG : undefined,
                  color: playing === letter.id ? "#8BA3B1" : "#2D2D2D",
                }}
              >
                <Volume2 className="w-[11vmin] h-[11vmin]" />
                {solved && <CountBadge count={game?.counts?.[String(letter.id)]} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (solved || isWrong) return;
                  game?.onPick?.(String(letter.id), isTarget);
                  if (isTarget) setFound(true);
                  else setWrong((w) => [...w, letter.id]);
                }}
                disabled={solved || isWrong}
                aria-label="Choisir ce son"
                className="w-[9vmin] h-[9vmin] rounded-full border-4 flex items-center justify-center transition-colors"
                style={{
                  borderColor: "#6B705C",
                  background: solved && isTarget ? "#6B705C" : "#FFFDF8",
                  color: solved && isTarget ? "#FFFDF8" : "#6B705C",
                }}
              >
                <Check className="w-[5vmin] h-[5vmin]" strokeWidth={3} />
              </button>
            </motion.div>
          );
        })}
      </div>
      {solved && <Confetti />}
    </div>
  );
}

/** Niveau avancé : quelle est la lettre colorée dans ce mot ? */
function FindInWordSlide({ slide, game }: { slide: Extract<Slide, { kind: "findInWord" }>; game?: GameProps }) {
  const { before, target, after } = joinedSegments(slide.word.text);
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-[4vmin] mb-[4vmin]">
        <span className="text-[14vmin] leading-none">{slide.word.emoji}</span>
        <p className="text-[22vmin] leading-tight font-black text-[#2D2D2D] whitespace-nowrap" style={ARABIC_FONT}>
          {before}
          <span style={{ color: "#BB908E" }}>{target}</span>
          {after}
        </p>
      </div>
      <LetterChoices target={slide.target} choices={slide.choices} neutral game={game} />
    </div>
  );
}

/** Niveau avancé : quelle forme de la lettre complète ce mot ? */
function CompleteWordSlide({ slide, game }: { slide: Extract<Slide, { kind: "completeWord" }>; game?: GameProps }) {
  const [wrong, setWrong] = useState<string[]>([]);
  const [found, setFound] = useState(false);
  const solved = found || game?.revealed === true;
  const { letter } = slide;
  const { before, target, after } = joinedSegments(slide.word.text);
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-[4vmin] mb-[4vmin]">
        <span className="text-[14vmin] leading-none">{slide.word.emoji}</span>
        <p className="text-[22vmin] leading-tight font-black text-[#2D2D2D] whitespace-nowrap" style={ARABIC_FONT}>
          {before}
          {/* Le trou garde la largeur de la lettre : invisible, elle reste liée à ses voisines. */}
          <span
            className="rounded-[1.5vmin] transition-colors"
            style={solved
              ? { color: letter.color }
              : { color: "transparent", background: "#EDE5D8", boxShadow: "inset 0 0 0 0.5vmin #CCB9B5" }}
          >
            {target}
          </span>
          {after}
        </p>
      </div>
      <div className="flex justify-center gap-[2.5vmin]" dir="rtl">
        {slide.choices.map((choice) => {
          const isTarget = isRightForm(slide, choice);
          const isWrong = wrong.includes(choice.position);
          return (
            <motion.button
              key={choice.position}
              onClick={(e) => {
                e.stopPropagation();
                if (solved || isWrong) return;
                game?.onPick?.(choice.position, isTarget);
                if (isTarget) setFound(true);
                else setWrong((w) => [...w, choice.position]);
              }}
              animate={isWrong ? { x: [0, -10, 10, -6, 6, 0], opacity: 0.3 } : solved && isTarget ? { scale: [1, 1.2, 1.1] } : {}}
              whileHover={solved || isWrong ? undefined : { scale: 1.06 }}
              className="relative w-[28vmin] h-[28vmin] rounded-[3vmin] bg-[#FFFDF8] border-4 shadow-md text-[17vmin] leading-none font-black text-[#2D2D2D] flex items-center justify-center"
              style={{ ...ARABIC_FONT, borderColor: solved && isTarget ? "#6B705C" : letter.color, background: solved && isTarget ? SOLVED_BG : undefined }}
            >
              {choice.glyph}
              {solved && <CountBadge count={game?.counts?.[choice.position]} />}
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
    case "letter": return <LetterSlide letter={slide.letter} />;
    case "forms": return <FormsSlide slide={slide} step={step} />;
    case "write": return <WriteSlide slide={slide} game={game} />;
    case "findLetter": return <FindLetterSlide slide={slide} game={game} />;
    case "pickSound": return <PickSoundSlide slide={slide} game={game} />;
    case "findInWord": return <FindInWordSlide slide={slide} game={game} />;
    case "completeWord": return <CompleteWordSlide slide={slide} game={game} />;
    case "flashcard": return <FlashcardSlide slide={slide} step={step} />;
    case "blur": return <BlurSlide slide={slide} step={step} />;
    case "missing": return <MissingSlide slide={slide} step={step} />;
    case "quiz": return <QuizSlide slide={slide} game={game} />;
    case "bravo": return <BravoSlide score={score} plain={slide.plain} />;
  }
}
