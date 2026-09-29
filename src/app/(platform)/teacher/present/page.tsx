"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize, Play, Users, Wifi, WifiOff, X } from "lucide-react";
import { fetchLessons } from "@/lib/lessonsApi";
import { charterColor, qcmAnswerLabel, stepsFor, teacherInstruction, teacherQuestion, type Slide } from "@/lib/presentation";
import type { SavedDeck } from "@/lib/liveDeck";
import { generateCode, isGame, summarize, type LiveState } from "@/lib/liveSession";
import { useLiveHost } from "@/lib/useLiveSession";
import { SlideView } from "@/components/present/Slides";
import { LETTER_POSITIONS } from "@/data/letterWords";

type RuleKind = "beginner" | "advanced" | "vocab";

/** Règles de chaque écran, rappelées à l'enseignant avant la séance, pour le mode qu'il a choisi. */
const GAME_RULES: { kind: RuleKind; mode: string; games: { name: string; rule: string }[] }[] = [
  {
    kind: "beginner",
    mode: "Lettres — niveau débutant",
    games: [
      { name: "Tracé de la lettre", rule: "La lettre s'écrit seule à l'écran, trait après trait. Vous dites son nom et son son ; le bouton ↻ rejoue le tracé." },
      { name: "Écrire au doigt", rule: "L'élève repasse la lettre sur son pointillé, au doigt ou à la souris. Le départ, le sens et l'ordre des traits sont vérifiés ; un trait raté s'efface et se recommence. La lettre terminée compte comme une bonne réponse." },
      { name: "Où est la lettre ?", rule: "Trois cartes. Vous annoncez la lettre à retrouver (elle est rappelée dans la barre de commandes) ; l'élève touche la bonne carte. Une erreur grise la carte, il réessaie." },
      { name: "Quel est le son ?", rule: "La lettre est affichée ; trois haut-parleurs identiques proposent trois sons. L'élève écoute chacun, puis coche celui de la lettre. Le son attendu est rappelé dans la barre de commandes." },
    ],
  },
  {
    kind: "advanced",
    mode: "Lettres — niveau avancé",
    games: [
      { name: "Les trois formes", rule: "Début, milieu et fin de mot se révèlent une à une, chacune avec un mot où la lettre est colorée. Vous lisez le mot ; son sens est rappelé dans la barre de commandes." },
      { name: "Quelle est la lettre colorée ?", rule: "Un mot est affiché, une lettre en couleur. L'élève choisit cette lettre parmi trois cartes de couleur neutre." },
      { name: "Compléter le mot", rule: "Un mot avec un trou à la place de la lettre du jour. L'élève choisit, parmi ses formes début / milieu / fin, celle qui complète le mot." },
      { name: "Écrire les formes liées", rule: "Comme « Écrire au doigt », mais pour chaque forme de la lettre. La forme à écrire est rappelée dans la barre de commandes." },
    ],
  },
  {
    kind: "vocab",
    mode: "Leçon de vocabulaire",
    games: [
      { name: "Cartes", rule: "Une image par carte. « Suivant » la retourne pour montrer le mot, s'il est écrit ; sinon vous le dites." },
      { name: "Animations", rule: "Après la carte, l'animation du mot s'il en a (on coupe la pomme, on presse l'orange, on épluche la banane, on mange la fraise, on lave le raisin). Elle tourne en boucle, sans son : vous racontez. Ce qu'elle montre est rappelé dans la barre de commandes." },
      { name: "Devinette floutée", rule: "L'image apparaît très floue et se précise en trois étapes ; les élèves devinent à voix haute. Rien à cliquer : la dernière étape révèle l'image et le mot." },
      { name: "Qu'est-ce qui a disparu ?", rule: "Quatre images à mémoriser. « Suivant » en fait disparaître une : les élèves disent laquelle. « Suivant » encore la fait réapparaître." },
      { name: "Quelle animation ?", rule: "En dernier, dès deux mots animés : deux ou trois animations tournent côte à côte. Vous demandez celle qui montre tel geste (la question en arabe est rappelée dans la barre de commandes) ; l'élève touche la bonne." },
      { name: "Quiz en images", rule: "Sans QCM dans la leçon : un mot écrit et quatre images, l'élève touche la bonne. Ne concerne que les mots écrits." },
      { name: "QCM de la leçon", rule: "Vos quiz à choix multiple, dans l'ordre de la leçon. La question s'affiche si vous l'avez écrite ; sinon, quand l'image de la bonne réponse est connue, elle vous est proposée en arabe (« أَيْنَ … ؟ ») ; sinon vous la posez. L'élève touche la bonne réponse ; elle est rappelée dans la barre de commandes." },
    ],
  },
];
/** Leçon d'enseignant dont le diaporama est enregistré. */
interface SavedLesson { id: string; title: string; live: SavedDeck }

export default function TeacherPresentPage() {
  const [session, setSession] = useState<{ deck: Slide[]; code: string } | null>(null);

  return session ? (
    <Player deck={session.deck} code={session.code} onQuit={() => setSession(null)} />
  ) : (
    <Setup onStart={(deck) => setSession({ deck, code: generateCode() })} />
  );
}

/** Parties d'un diaporama enregistré, pour n'en rappeler que les règles utiles. */
function deckKinds(deck: readonly Slide[]): RuleKind[] {
  const kinds: RuleKind[] = [];
  if (deck.some((s) => s.kind === "forms")) kinds.push("advanced");
  else if (deck.some((s) => s.kind === "letter")) kinds.push("beginner");
  if (deck.some((s) => s.kind === "flashcard" || s.kind === "qcm" || s.kind === "quiz")) kinds.push("vocab");
  return kinds;
}

function Setup({ onStart }: { onStart: (deck: Slide[]) => void }) {
  // Diaporamas enregistrés : ceux des leçons dont la vidéo d'introduction a été créée depuis l'éditeur.
  const [lessons, setLessons] = useState<SavedLesson[] | null>(null);
  const [lessonsError, setLessonsError] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons()
      .then((all) => setLessons(all.flatMap((l) => (l.live ? [{ id: l.id, title: l.title, live: l.live }] : []))))
      .catch(() => { setLessonsError(true); setLessons([]); });
  }, []);

  const lesson = lessons?.find((l) => l.id === lessonId) ?? lessons?.[0] ?? null;
  const kinds = lesson ? deckKinds(lesson.live.slides) : [];

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
          Choisissez le diaporama d&apos;une leçon, puis partagez cet écran dans votre visioconférence.
          La présentation est entièrement visuelle : vous en assurez le commentaire.
        </p>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <p className="font-bold text-[#2d2d2d] mb-1">Diaporamas enregistrés</p>
          <p className="text-xs text-gray-500 mb-3">
            Chaque diaporama est tiré de la vidéo d&apos;introduction de sa leçon : mêmes lettres, mêmes images, dans le même ordre.
            Pour en créer un, ouvrez la leçon dans l&apos;éditeur et cliquez sur « Créer la vidéo et le diaporama ».
          </p>
          {lessons === null ? (
            <p className="text-sm text-gray-400">Chargement des diaporamas…</p>
          ) : lessons.length === 0 ? (
            <div className="text-sm text-gray-600 bg-[#F5EEE8] rounded-xl p-4">
              {lessonsError
                ? "Les leçons n'ont pas pu être chargées. Vérifiez votre connexion, puis rechargez la page."
                : "Aucun diaporama n'est encore enregistré."}{" "}
              <Link href="/teacher/create" className="font-bold text-[#BB908E] hover:underline">Créer une leçon</Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {lessons.map((l, i) => (
                <button
                  key={l.id}
                  onClick={() => setLessonId(l.id)}
                  aria-pressed={lesson?.id === l.id}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    lesson?.id === l.id ? "text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-[#BB908E]"
                  }`}
                  style={lesson?.id === l.id ? { background: charterColor(i) } : {}}
                >
                  {l.title}{" "}
                  <span className="font-semibold opacity-70">· {l.live.slides.length} écrans</span>
                </button>
              ))}
            </div>
          )}
          {lesson && (
            <p className="text-xs text-gray-500 mt-3">
              Enregistré le {new Date(lesson.live.createdAt).toLocaleString("fr-BE", { dateStyle: "long", timeStyle: "short" })}.{" "}
              <Link href={`/teacher/create?edit=${lesson.id}`} className="font-bold text-[#BB908E] hover:underline">Modifier la leçon</Link>
            </p>
          )}
        </div>

        <button
          onClick={() => lesson && onStart(lesson.live.slides)}
          disabled={!lesson}
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
            <li>• Les écrans de lettres ne comportent aucun texte français : vous énoncez les consignes. Au jeu « Où est la lettre ? », la lettre à annoncer est rappelée dans la barre de commandes</li>
            <li>• Les QCM affichent la question telle que vous l&apos;avez rédigée ; la bonne réponse est rappelée dans la barre de commandes</li>
            <li>• Dans tous les jeux, seul le premier essai de chaque élève compte dans le décompte par réponse ; après une erreur, il peut réessayer jusqu&apos;à trouver</li>
          </ul>

          <p className="font-bold text-[#8b6f47] mt-5 mb-2">🎲 Règles des jeux</p>
          <div className="space-y-4">
            {kinds.flatMap((kind) => GAME_RULES.filter((group) => group.kind === kind)).map((group) => (
              <div key={group.mode}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8b6f47]/70 mb-1">{group.mode}</p>
                <dl className="space-y-1.5 text-sm text-[#8b6f47]">
                  {group.games.map((game) => (
                    <div key={game.name}>
                      <dt className="inline font-bold">{game.name} — </dt>
                      <dd className="inline">{game.rule}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
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
  const question = teacherQuestion(slide);
  const instruction = teacherInstruction(slide);

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

      {/* Question à poser à voix haute : l'écran de l'élève ne l'affiche pas */}
      {question && (
        <p
          className="text-center text-[5vmin] leading-tight font-bold text-[#2D2D2D]/70 pt-2 px-6"
          style={{ fontFamily: "'Noto Naskh Arabic', 'Cairo', serif", direction: /[\u0600-\u06FF]/.test(question) ? "rtl" : "ltr" }}
        >
          {question}
        </p>
      )}

      {/* Consigne du jeu de fin de leçon, pour l'enseignant seulement */}
      {instruction && (
        <p className="text-center text-[3.4vmin] leading-tight font-bold text-[#2D2D2D]/70 pt-2 px-6">
          {instruction}
        </p>
      )}

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

        {/* Repères pour l'enseignant ; le nom des lettres n'est jamais écrit, il le dit lui-même. */}
        {slide.kind === "write" && slide.form && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Forme à écrire :{" "}
            <span className="text-[#2D2D2D]">{{ initial: "début", medial: "milieu", final: "fin" }[slide.form]} du mot</span>
          </span>
        )}
        {slide.kind === "video" && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Animation : <span className="text-[#2D2D2D]">{slide.caption}</span>
          </span>
        )}
        {slide.kind === "qcm" && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Bonne réponse : <span className="text-[#2D2D2D]">{qcmAnswerLabel(slide.qcm)}</span>
          </span>
        )}
        {slide.kind === "pickSound" && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Réponse attendue :{" "}
            <span className="text-[#2D2D2D]">son « {slide.target.translit} »</span>
          </span>
        )}
        {(slide.kind === "findInWord" || slide.kind === "completeWord") && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Sens du mot : <span className="text-[#2D2D2D]">{slide.word.french}</span>
          </span>
        )}
        {slide.kind === "forms" && (
          <span className="text-sm font-bold text-[#2D2D2D]/50">
            Sens des mots :{" "}
            <span className="text-[#2D2D2D]">
              {LETTER_POSITIONS.map((position) => slide.words[position].french).join(" · ")}
            </span>
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
