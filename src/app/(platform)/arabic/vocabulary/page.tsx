"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Volume2 } from "lucide-react";
import { VOCAB_THEMES, ArabicWord, VocabTheme } from "@/data/arabicVocabulary";
import StudentShell, { STUDENT_ICON } from "@/components/student/StudentShell";
import { ThemeArt } from "@/components/student/ThemeArt";
import { VocabPicture } from "@/components/student/VocabPicture";
import { INSTRUCTION_ID, loadVocabSounds, playVocabSound, type VocabSounds } from "@/lib/vocabSound";
import { accentAt, accentButton } from "@/components/student/accents";
import { LazyConfetti } from "@/components/LazyConfetti";

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
  const [audioFailed, setAudioFailed] = useState(false);
  // Sons enregistrés par l'enseignant sur la plateforme ({ id du mot: URL }).
  const [sounds, setSounds] = useState<VocabSounds>({});
  useEffect(() => { let active = true; loadVocabSounds().then((s) => { if (active) setSounds(s); }); return () => { active = false; }; }, []);

  const startTheme = useCallback((t: VocabTheme) => {
    setTheme(t);
    setRound(buildRound(t.words));
    setSelected(null);
    setScore(0);
    setTotal(0);
    setPhase("exercise");
    // La consigne, si l'enseignant l'a enregistrée : une fois, en entrant dans l'exercice (le toucher sur le thème autorise le son).
    if (sounds[INSTRUCTION_ID]) void playVocabSound(INSTRUCTION_ID);
  }, [sounds]);

  const playAudio = useCallback(() => {
    if (!theme || !round) return;
    setAudioFailed(false);
    void playVocabSound(round.target.id).then((ok) => { if (!ok) setAudioFailed(true); });
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
    setAudioFailed(false);
    setRound(buildRound(theme.words));
  }, [theme]);

  /* ── Theme selection ── */
  if (phase === "themes") {
    return (
      <StudentShell>
        <div className="flex flex-col gap-8">
          <Link href="/arabic" data-variant="quiet" className="ms-button -ms-3 self-start text-ms-ink">
            <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Apprends l&apos;arabe
          </Link>

          <header className="flex flex-col gap-2">
            <p lang="ar" dir="rtl" className="ms-arabic self-start text-xl text-ms-muted">المُفْرَدَات</p>
            <h1 className="text-[2rem] font-extrabold leading-10 tracking-[-0.02em]">Choisis un thème</h1>
            <p className="text-ms-muted">Pour chaque mot, trouve la bonne image.</p>
          </header>

          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {VOCAB_THEMES.map((t, i) => {
              const accent = accentAt(i);
              return (
                <li key={t.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => startTheme(t)}
                    className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-ms-line bg-ms-surface text-start shadow-[var(--ms-shadow-student)] transition-[border-color,transform] duration-[140ms] hover:border-ms-control active:scale-[0.99]"
                  >
                    {/* L'illustration du thème, en grand, sur le pastel de sa place dans la liste. */}
                    <span className="flex h-28 w-full items-end justify-center px-4 pt-3 sm:h-36" style={{ background: accent.soft }}>
                      <ThemeArt themeId={t.id} className="h-full w-auto max-w-full transition-transform duration-[140ms] group-hover:-translate-y-0.5" />
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 p-4">
                      <span className="text-xl font-extrabold leading-7 [overflow-wrap:anywhere]">{t.nameFrench}</span>
                      <span lang="ar" dir="rtl" className="ms-arabic self-start text-lg text-ms-ink">{t.nameArabic}</span>
                      <span className="mt-1 text-sm text-ms-muted tabular-nums">{t.words.length} mots</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </StudentShell>
    );
  }

  /* ── Exercise ── */
  if (!round || !theme) return null;
  const { target, choices } = round;
  const isCorrect = selected === target.id;
  const accent = accentAt(VOCAB_THEMES.findIndex((t) => t.id === theme.id));
  // L'enregistrement de la question n'existe que si l'enseignant l'a déposé sur cet appareil.
  const hasAudio = !!sounds[target.id];

  return (
    <StudentShell>
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setPhase("themes")} data-variant="quiet" className="ms-button -ms-3 text-ms-ink">
            <ArrowLeft size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Thèmes
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-16 shrink-0 items-end justify-center overflow-hidden rounded-xl px-1 pt-1" style={{ background: accent.soft }}>
              <ThemeArt themeId={theme.id} className="h-full w-auto" />
            </span>
            <span className="truncate text-lg font-extrabold">{theme.nameFrench}</span>
            <span className="ms-status tabular-nums">{score} sur {total}</span>
          </div>
        </div>
        <div className="h-1 rounded-full" style={{ background: accent.pastel }} aria-hidden="true" />

        {/* Question */}
        <section aria-labelledby="question" className="ms-panel flex flex-col items-center gap-3 px-5 py-6 text-center sm:px-8">
          <p className="text-xl font-bold leading-7 sm:text-2xl sm:leading-8">{hasAudio ? "Écoute, puis choisis l'image." : "Choisis l'image."}</p>
          <h1 id="question" lang="ar" dir="rtl" className="ms-arabic text-[clamp(3rem,7vw,4.5rem)]">
            أَيْنَ {target.arabic}؟
          </h1>
          <p className="text-lg font-semibold text-ms-muted">Où est {target.french}&nbsp;?</p>
          {hasAudio && (
            <button type="button" onClick={playAudio} data-variant="primary" className="ms-button min-w-44" style={accentButton(accent)}>
              <Volume2 size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" /> Écouter
            </button>
          )}
          {audioFailed && (
            <p role="alert" className="flex flex-wrap items-center justify-center gap-3 text-ms-danger">
              Le son n&apos;a pas pu démarrer.
              <button type="button" onClick={playAudio} data-variant="secondary" className="ms-button">Réessayer</button>
            </p>
          )}
        </section>

        {/* 3 choices */}
        <div role="group" aria-label="Images à choisir" className="ms-answer-grid rounded-3xl p-2 min-[400px]:p-3 sm:p-5"
          style={{ background: accent.soft, maxInlineSize: "40rem" }}>
          {choices.map((word) => {
            const isThis = selected === word.id;
            const isAnswer = word.id === target.id;
            // Réponse trouvée ou montrée : coche ; image choisie à tort : effacée, sans tremblement.
            const state = selected && isAnswer ? "found" : isThis ? "tried" : "rest";
            return (
              <button
                key={word.id}
                type="button"
                onClick={() => handleSelect(word)}
                disabled={!!selected}
                data-state={state}
                aria-label={`${word.french}${state === "found" ? " — bonne réponse" : state === "tried" ? " — ton choix" : ""}`}
                className="ms-answer-tile"
              >
                {/* L'image du mot (photo, dessin ou pictogramme), toujours dans le même carré. */}
                <span className="ms-answer-glyph block w-full max-w-40 overflow-hidden rounded-2xl" aria-hidden="true">
                  <VocabPicture word={word} sizes="(min-width: 640px) 10rem, 30vw" />
                </span>
                {selected && (
                  <span lang="ar" dir="rtl" className="ms-arabic ms-answer-glyph text-xl">{word.arabic}</span>
                )}
                {state === "found" && (
                  <span className="absolute end-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-ms-blush text-ms-ink">
                    <Check size={22} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback — zone réservée pour que la page ne saute pas */}
        <div aria-live="polite" className="flex min-h-40 flex-col items-center gap-4 text-center">
          {selected && (
            <>
              {isCorrect ? (
                <>
                  <LazyConfetti />
                  <p className="sr-only">Tu as trouvé.</p>
                </>
              ) : (
                <div>
                  <p className="text-xl font-bold leading-7 text-ms-muted">Voici la bonne image.</p>
                  <p className="mt-1">
                    <span lang="ar" dir="rtl" className="ms-arabic text-[1.75rem]">{target.arabic}</span>
                    <span className="ms-2 font-semibold text-ms-muted">{target.french}</span>
                  </p>
                </div>
              )}
              <button type="button" onClick={next} data-variant="primary" className="ms-button min-w-60" style={accentButton(accent)}>
                Question suivante <ChevronRight size={STUDENT_ICON} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
