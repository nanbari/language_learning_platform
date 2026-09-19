"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize, Play, Users, Wifi, WifiOff, X } from "lucide-react";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { VOCAB_THEMES } from "@/data/arabicVocabulary";
import { buildLetterDeck, buildVocabDeck, charterColor, lettersPerLesson, stepsFor, MAX_REVIEW_LETTERS, WORD_COUNTS, type LetterLevel, type Slide } from "@/lib/presentation";
import { classScore, generateCode, isGame, summarize, type LiveState } from "@/lib/liveSession";
import { useLiveHost } from "@/lib/useLiveSession";
import { SlideView } from "@/components/present/Slides";
import { LetterGlyph } from "@/components/present/LetterTracing";

type LessonKind = "letter" | "vocab";

export default function TeacherPresentPage() {
  const [session, setSession] = useState<{ deck: Slide[]; code: string } | null>(null);

  return session ? (
    <Player deck={session.deck} code={session.code} onQuit={() => setSession(null)} />
  ) : (
    <Setup onStart={(deck) => setSession({ deck, code: generateCode() })} />
  );
}

function Setup({ onStart }: { onStart: (deck: Slide[]) => void }) {
  const [kind, setKind] = useState<LessonKind>("letter");
  const [letterIds, setLetterIds] = useState(() => ARABIC_ALPHABET.slice(0, lettersPerLesson("beginner")).map((l) => l.id));
  const [level, setLevel] = useState<LetterLevel>("beginner");
  const [reviewIds, setReviewIds] = useState<number[]>([]);
  const perLesson = lettersPerLesson(level);
  const [themeId, setThemeId] = useState(VOCAB_THEMES[0].id);
  const [wordCount, setWordCount] = useState<number>(WORD_COUNTS[1]);

  // Au-delà de trois lettres, la plus anciennement choisie cède sa place.
  const toggleLetter = (id: number) => {
    setLetterIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id].slice(-perLesson)));
    setReviewIds((ids) => ids.filter((i) => i !== id));
  };

  const toggleReview = (id: number) => {
    setReviewIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id].slice(-MAX_REVIEW_LETTERS)));
  };

  // En passant au niveau avancé, seule la dernière lettre choisie est conservée.
  const changeLevel = (next: LetterLevel) => {
    setLevel(next);
    setLetterIds((ids) => ids.slice(-lettersPerLesson(next)));
  };

  const ready = kind === "vocab" || letterIds.length === perLesson;

  const start = () => {
    onStart(kind === "letter" ? buildLetterDeck(letterIds, level, reviewIds) : buildVocabDeck(themeId, wordCount));
  };

  return (
    <div className="min-h-screen bg-[#fffef9]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/teacher" className="flex items-center gap-2 text-gray-500 hover:text-[#BB908E] transition-colors">
          <ArrowLeft size={18} /> Tableau de bord
        </Link>
        <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          🎬 Cours en direct
        </span>
        <div className="w-32" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-[#2d2d2d] mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Présenter une leçon
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Choisissez le contenu de la séance, puis partagez cet écran dans votre visioconférence.
          La présentation est entièrement visuelle : vous en assurez le commentaire.
        </p>

        <div className="flex gap-2 mb-6">
          {([["letter", "🔤 Des lettres"], ["vocab", "🖼️ Un thème de vocabulaire"]] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                kind === value ? "bg-[#6B705C] text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-[#BB908E]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === "letter" ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <p className="font-bold text-[#2d2d2d] mb-3">Niveau</p>
            <div className="flex gap-2">
              {([["beginner", "Débutant"], ["advanced", "Avancé"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => changeLevel(value)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    level === value ? "bg-[#6B705C] text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-[#BB908E]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="font-bold text-[#2d2d2d] mt-5 mb-3">
              {perLesson > 1 ? "Lettres étudiées" : "Lettre étudiée"}{" "}
              <span className="font-semibold text-gray-400">
                — {letterIds.length}/{perLesson} sélectionnée{perLesson > 1 ? "s" : ""}
              </span>
            </p>
            <div className="grid grid-cols-7 gap-2" dir="rtl">
              {ARABIC_ALPHABET.map((letter) => (
                <button
                  key={letter.id}
                  onClick={() => toggleLetter(letter.id)}
                  aria-pressed={letterIds.includes(letter.id)}
                  title={letter.nameTranslit}
                  className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
                    letterIds.includes(letter.id) ? "text-white shadow-md scale-105" : "bg-white text-[#2d2d2d] hover:scale-105"
                  }`}
                  style={{
                    borderColor: charterColor(letter.id - 1),
                    background: letterIds.includes(letter.id) ? charterColor(letter.id - 1) : undefined,
                  }}
                >
                  <LetterGlyph char={letter.isolated} className="w-3/4 h-3/4" />
                </button>
              ))}
            </div>
            <p className="font-bold text-[#2d2d2d] mt-5 mb-1">
              Lettres à réviser{" "}
              <span className="font-semibold text-gray-400">
                — facultatif, {reviewIds.length}/{MAX_REVIEW_LETTERS} au plus
              </span>
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Rappelées puis proposées en exercice à la fin de la séance, après les lettres du jour.
            </p>
            <div className="grid grid-cols-7 gap-2" dir="rtl">
              {ARABIC_ALPHABET.map((letter) => {
                const inLesson = letterIds.includes(letter.id);
                const selected = reviewIds.includes(letter.id);
                return (
                  <button
                    key={letter.id}
                    onClick={() => toggleReview(letter.id)}
                    disabled={inLesson}
                    aria-pressed={selected}
                    title={inLesson ? `${letter.nameTranslit} — lettre de la leçon` : letter.nameTranslit}
                    className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed ${
                      selected ? "text-white shadow-md scale-105" : "bg-white text-[#2d2d2d] enabled:hover:scale-105"
                    }`}
                    style={{ borderColor: "#7B868E", background: selected ? "#7B868E" : undefined }}
                  >
                    <LetterGlyph char={letter.isolated} className="w-3/4 h-3/4" />
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              {level === "beginner"
                ? "Déroulé : tracé animé de chaque lettre isolée. Les exercices sont regroupés en fin de séance : l'élève écrit chaque lettre au doigt (modèle en filigrane, puis en pointillé), puis chacune des trois lettres est à retrouver parmi les trois lettres de la leçon, puis viennent les lettres à réviser. Aucune forme liée ni mot écrit en arabe."
                : "Une lettre par séance. Déroulé : tracé animé, trois formes (début, milieu, fin), puis trois mots illustrés où la lettre, mise en couleur, figure au début, au milieu et à la fin. Les exercices viennent en fin de séance : l'élève écrit la lettre au doigt (modèle en filigrane, puis en pointillé), puis la lettre est à retrouver parmi trois cartes, complétées par les lettres à réviser (à défaut, par d'autres lettres). Les lettres à réviser suivent, au même niveau : pour chacune, un mot où elle est colorée, et l'élève désigne la lettre."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <p className="font-bold text-[#2d2d2d] mb-3">Thème</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {VOCAB_THEMES.map((theme, i) => (
                <button
                  key={theme.id}
                  onClick={() => setThemeId(theme.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    themeId === theme.id ? "text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-[#BB908E]"
                  }`}
                  style={themeId === theme.id ? { background: charterColor(i) } : {}}
                >
                  {theme.emoji} {theme.nameFrench}
                </button>
              ))}
            </div>
            <p className="font-bold text-[#2d2d2d] mb-3">Nombre de mots présentés</p>
            <div className="flex gap-2">
              {WORD_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => setWordCount(count)}
                  className={`w-12 h-10 rounded-xl text-sm font-bold transition-all ${
                    wordCount === count ? "bg-[#6B705C] text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-[#BB908E]"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Déroulé : cartes à retourner, devinettes floutées, « Qu&apos;est-ce qui a disparu ? », puis quiz en images.
              Les mots sont tirés au sort à chaque présentation.
            </p>
          </div>
        )}

        <button
          onClick={start}
          disabled={!ready}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow hover:shadow-md hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100"
          style={{ background: "#BB908E" }}
        >
          <Play size={16} fill="white" /> Lancer la présentation
        </button>

        <div className="mt-8 bg-[#fff8ee] rounded-2xl p-5 border border-[#ffd166]/30">
          <p className="font-bold text-[#8b6f47] mb-2">💡 Conseils pour la séance</p>
          <ul className="space-y-1 text-sm text-[#8b6f47]">
            <li>• Passez en plein écran, puis partagez la fenêtre dans votre visioconférence</li>
            <li>• Les flèches du clavier ← → ou la barre d&apos;espace font avancer la présentation</li>
            <li>• Communiquez le code de séance aux élèves : depuis leur espace, ils suivent les écrans et répondent eux-mêmes aux jeux</li>
            <li>• Pendant un jeu, cliquez sur la bonne réponse pour afficher la solution chez tous les élèves</li>
            <li>• Les écrans ne comportent aucun texte français : vous énoncez les consignes. Au jeu « Où est la lettre ? », la lettre à annoncer est rappelée dans la barre de commandes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Player({ deck, code, onQuit }: { deck: Slide[]; code: string; onQuit: () => void }) {
  const [pos, setPos] = useState({ index: 0, step: 0 });
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const slide = deck[pos.index];
  const revealed = revealedIndex === pos.index;

  const liveState = useMemo<LiveState>(
    () => ({ index: pos.index, total: deck.length, step: pos.step, slide: deck[pos.index], revealed }),
    [deck, pos, revealed],
  );
  const { participants, tally, connected } = useLiveHost(code, liveState);
  const summary = summarize(tally, pos.index);

  const next = useCallback(() => {
    setPos((p) => {
      if (p.step < stepsFor(deck[p.index])) return { index: p.index, step: p.step + 1 };
      if (p.index < deck.length - 1) return { index: p.index + 1, step: 0 };
      return p;
    });
  }, [deck]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p.step > 0) return { index: p.index, step: p.step - 1 };
      if (p.index > 0) return { index: p.index - 1, step: 0 };
      return p;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const quit = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    onQuit();
  };

  const isFirst = pos.index === 0 && pos.step === 0;
  const isLast = pos.index === deck.length - 1 && pos.step >= stepsFor(slide);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5EEE8] overflow-hidden select-none">
      {/* Séance : code à communiquer aux élèves et présence */}
      <div className="flex items-center justify-between gap-4 px-5 py-2 text-sm font-bold text-[#2D2D2D]/60">
        <span className="flex items-center gap-2">
          {connected ? <Wifi size={15} className="text-[#6B705C]" /> : <WifiOff size={15} className="text-[#BB908E]" />}
          Espace élève › Cours en direct · code
          <span className="px-2.5 py-0.5 rounded-lg bg-[#FFFDF8] border border-[#EDE5D8] text-lg font-black tracking-[0.25em] text-[#2D2D2D]">
            {code}
          </span>
        </span>
        <span className="flex items-center gap-1.5" title={participants.map((p) => p.name).join(", ")}>
          <Users size={15} /> {participants.length} élève{participants.length > 1 ? "s" : ""} connecté{participants.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Scène : un clic dans le vide révèle l'étape suivante */}
      <div className="flex-1 flex items-center justify-center px-6 cursor-pointer" onClick={next}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pos.index}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <SlideView
              slide={slide}
              step={pos.step}
              score={classScore(tally)}
              game={{
                revealed,
                counts: summary.counts,
                // Écrire la lettre soi-même, en démonstration, ne révèle rien aux élèves.
                onPick: (_, correct) => { if (correct && slide.kind !== "write") setRevealedIndex(pos.index); },
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Réponses des élèves au jeu en cours */}
      {isGame(slide) && participants.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-5 pb-3 text-sm font-bold text-[#2D2D2D]/60">
          <span>{summary.answered}/{participants.length} {slide.kind === "write" ? "ont terminé" : "ont répondu"}</span>
          {summary.found.map((name) => (
            <motion.span
              key={name}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full bg-[#999B84]/40 text-[#2D2D2D]"
            >
              ✓ {name}
            </motion.span>
          ))}
        </div>
      )}

      {/* Commandes */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 bg-[#FFFDF8]/80 border-t border-[#EDE5D8]">
        <button
          onClick={quit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold text-[#2D2D2D]/50 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <X size={16} /> Quitter
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={prev}
            disabled={isFirst}
            aria-label="Précédent"
            className="w-12 h-12 rounded-full bg-white border border-[#EDE5D8] shadow-sm flex items-center justify-center text-[#2D2D2D]/70 hover:scale-110 transition-transform disabled:opacity-30 disabled:hover:scale-100"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-1.5">
            {deck.map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all"
                style={{ width: i === pos.index ? 22 : 8, background: i <= pos.index ? "#BB908E" : "#CCB9B5" + "60" }}
              />
            ))}
          </div>
          <button
            onClick={next}
            disabled={isLast}
            aria-label="Suivant"
            className="w-12 h-12 rounded-full text-white shadow flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-30 disabled:hover:scale-100"
            style={{ background: "#BB908E" }}
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Les écrans n'ont plus de consigne écrite : rappel de la lettre à annoncer. */}
        {slide.kind === "findLetter" && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            À annoncer : <span className="text-[#2D2D2D]">{slide.target.nameTranslit}</span>
          </span>
        )}
        {(slide.kind === "example" || slide.kind === "findInWord") && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Sens du mot : <span className="text-[#2D2D2D]">{slide.word.french}</span>
          </span>
        )}

        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold text-[#2D2D2D]/50 hover:text-[#6B705C] hover:bg-[#6B705C]/10 transition-colors"
        >
          {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          {fullscreen ? "Réduire" : "Plein écran"}
        </button>
      </div>
    </div>
  );
}
