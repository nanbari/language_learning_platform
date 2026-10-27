"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { MessageCircleQuestion, Type } from "lucide-react";
import TeacherShell from "@/components/teacher/TeacherShell";
import { useTeacherSession } from "@/components/teacher/useTeacherSession";
import { ICON_STROKE, SkeletonRows } from "@/components/platform/ui";
import AudioRecorderRow, { micErrorMessage, type RecorderPhase } from "@/components/teacher/audio/AudioRecorderRow";
import { AudioLibraryPanel, RecordedProgress, RecordingTips } from "@/components/teacher/audio/AudioLibraryPanel";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { uploadMedia } from "@/lib/mediaUpload";
import { needsMp3Transcode, transcodeToMp3 } from "@/lib/audioTranscode";
import {
  QUESTION_KINDS, deleteSound, forgetSounds, loadSounds, saveSound, spokenSound,
  type QuestionKind, type Sounds,
} from "@/lib/letterSound";

/** Question telle qu'écrite au-dessus de l'exercice, et ce qu'il demande. */
const QUESTIONS: Record<QuestionKind, { arabic: string; label: string }> = {
  pickSound: { arabic: "مَا صَوْتُ هَذَا الْحَرْفِ؟", label: "Choisir le son" },
  findInWord: { arabic: "مَا اسْمُ الْحَرْفِ الْمُلَوَّنِ؟", label: "Lettre dans un mot (avancé)" },
  completeWord: { arabic: "أَيُّ شَكْلٍ يُكْمِلُ الْكَلِمَةَ؟", label: "Compléter le mot (avancé)" },
};

/** Tuiles des lettres : les trois pastels de la charte, en alternance. */
const TILES = ["bg-ms-slate-soft text-ms-slate-ink", "bg-ms-sage-soft text-ms-sage-ink", "bg-ms-blush-soft text-ms-blush-ink"];

/** Ce qu'on enregistre : le son d'une lettre ou la question d'un exercice. */
type Target = { letterId: number } | { question: QuestionKind };
const keyOf = (t: Target) => ("letterId" in t ? `l${t.letterId}` : `q${t.question}`);

interface Entry {
  key: string;
  target: Target;
  name: string;
  replacement: string;
  hasAudio: boolean;
  search: string;
  leading: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
}

/**
 * Sons enregistrés par un admin, communs à toute la plateforme :
 * - le son de chaque lettre, joué dans l'exercice « choisir le son » ;
 * - la question de chaque exercice de lettres, lue à l'élève quand
 *   l'exercice apparaît dans une leçon.
 * Chaque enregistrement est converti en MP3, téléversé sur R2 et enregistré
 * dès l'arrêt du micro. L'accès est réservé aux admins (proxy et API).
 */
export default function LetterSoundsPage() {
  const { user, isAdmin, handleLogout } = useTeacherSession();
  const [sounds, setSounds] = useState<Sounds>({ letters: {}, questions: {} });
  const [loaded, setLoaded] = useState(false);
  const [requestingFor, setRequestingFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    forgetSounds();
    loadSounds().then((s) => { setSounds(s); setLoaded(true); });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const urlOf = (t: Target) => ("letterId" in t ? sounds.letters[t.letterId] : sounds.questions[t.question]);

  const setUrl = (t: Target, url: string | undefined) => setSounds((s) => {
    if ("letterId" in t) {
      const letters = { ...s.letters };
      if (url) letters[t.letterId] = url; else delete letters[t.letterId];
      return { ...s, letters };
    }
    const questions = { ...s.questions };
    if (url) questions[t.question] = url; else delete questions[t.question];
    return { ...s, questions };
  });

  const save = async (t: Target, name: string, recording: Blob) => {
    setSavingFor(keyOf(t));
    try {
      let blob = recording;
      if (needsMp3Transcode(blob.type)) {
        try { blob = await transcodeToMp3(blob); }
        catch (e) { console.warn("Conversion MP3 impossible, envoi du format d'origine", e); }
      }
      const ext = blob.type === "audio/mpeg" ? "mp3" : blob.type.includes("mp4") ? "m4a" : "webm";
      const file = new File([blob], `${keyOf(t)}.${ext}`, { type: blob.type });
      const url = await uploadMedia(file);
      await saveSound(t, url);
      // L'URL n'est remplacée qu'une fois le serveur d'accord : sinon l'ancien son reste.
      setUrl(t, url);
      setSavedFor(keyOf(t));
    } catch (e) {
      setError({ key: keyOf(t), text: `${name} : enregistrement non sauvegardé (${e instanceof Error ? e.message : "erreur inconnue"}).` });
    } finally {
      setSavingFor(null);
    }
  };

  const startRecording = async (t: Target, name: string) => {
    setError(null);
    setSavedFor(null);
    setRequestingFor(keyOf(t));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: (recorder.mimeType || "audio/webm").split(";")[0] });
        if (blob.size > 0) save(t, name, blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordingFor(keyOf(t));
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      setError({ key: keyOf(t), text: micErrorMessage(e) });
    } finally {
      setRequestingFor(null);
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingFor(null);
  };

  const remove = async (t: Target, name: string) => {
    setError(null);
    setSavedFor(null);
    try {
      await deleteSound(t);
      setUrl(t, undefined);
    } catch (e) {
      setError({ key: keyOf(t), text: `${name} : suppression impossible (${e instanceof Error ? e.message : "erreur inconnue"}).` });
    }
  };

  const busy = requestingFor !== null || recordingFor !== null || savingFor !== null;
  const activeKey = requestingFor ?? recordingFor ?? savingFor;

  const phaseOf = (key: string): RecorderPhase =>
    requestingFor === key ? "requesting"
      : recordingFor === key ? "recording"
        : savingFor === key ? "uploading"
          : error?.key === key ? "error"
            : savedFor === key ? "saved" : "idle";

  const questionEntries: Entry[] = QUESTION_KINDS.map((kind) => {
    const { arabic, label } = QUESTIONS[kind];
    const target: Target = { question: kind };
    return {
      key: keyOf(target), target, name: label, replacement: "La question restera seulement écrite.",
      hasAudio: !!urlOf(target), search: `${label} ${arabic}`,
      leading: (
        <span aria-hidden="true" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-ms-slate-soft text-ms-slate-ink">
          <MessageCircleQuestion size={22} strokeWidth={ICON_STROKE} />
        </span>
      ),
      title: <span lang="ar" dir="rtl" className="ms-arabic block text-xl">{arabic}</span>,
      subtitle: label,
    };
  });

  const letterEntries: Entry[] = ARABIC_ALPHABET.map((letter, i) => {
    const target: Target = { letterId: letter.id };
    return {
      key: keyOf(target), target, name: letter.nameTranslit, replacement: "La voix de l'appareil la remplacera.",
      hasAudio: !!urlOf(target), search: `${letter.nameTranslit} ${letter.translit} ${letter.name} ${letter.isolated} ${letter.id}`,
      leading: (
        <span lang="ar" dir="rtl" aria-hidden="true"
          className={`ms-arabic flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-3xl leading-none ${TILES[i % TILES.length]}`}>
          {letter.isolated}
        </span>
      ),
      title: <span className="font-semibold">{letter.nameTranslit}</span>,
      subtitle: (
        <>Son : <span lang="ar" dir="rtl" className="ms-arabic text-base text-ms-ink">{spokenSound(letter)}</span> · lettre {letter.id}</>
      ),
    };
  });

  const renderRow = (e: Entry) => (
    <AudioRecorderRow
      key={e.key}
      id={`snd-${e.key}`}
      name={e.name}
      leading={e.leading}
      title={e.title}
      subtitle={e.subtitle}
      hasAudio={e.hasAudio}
      phase={phaseOf(e.key)}
      elapsed={duration}
      error={error?.key === e.key ? error.text : null}
      expanded={expanded === e.key}
      onToggle={() => setExpanded((k) => (k === e.key ? null : e.key))}
      locked={busy}
      canRecord={loaded}
      onRecord={() => startRecording(e.target, e.name)}
      onStop={stopRecording}
      onPlay={() => { const url = urlOf(e.target); if (url) new Audio(url).play(); }}
      onDelete={() => remove(e.target, e.name)}
      deleteHint={e.replacement}
    />
  );

  const lettersCount = letterEntries.filter((e) => e.hasAudio).length;
  const questionsCount = questionEntries.filter((e) => e.hasAudio).length;
  const tabClass =
    "ms-button data-[state=active]:!bg-ms-primary-soft data-[state=active]:!text-ms-primary data-[state=active]:!border-ms-primary";

  return (
    <TeacherShell name={user?.name || "Enseignant"} isAdmin={isAdmin} onLogout={handleLogout}>
      <div className="space-y-6">
        <header>
          <h1 className="text-[1.75rem] leading-9 lg:text-[2rem] lg:leading-10 font-semibold tracking-[-0.02em]">Sons des lettres</h1>
          <p className="mt-1 text-ms-muted max-w-[65ch]">
            Enregistrez le son de chaque lettre et les questions des exercices. Ces sons sont communs à toute la plateforme.
          </p>
        </header>

        <Tabs.Root defaultValue="letters" className="space-y-5">
          <Tabs.List aria-label="Bibliothèque audio" className="flex flex-wrap gap-2">
            <Tabs.Trigger value="letters" disabled={busy} data-variant="secondary" className={tabClass}>
              <Type size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Son de chaque lettre
              <span className="tabular-nums text-sm font-normal">{loaded ? `${lettersCount}/${ARABIC_ALPHABET.length}` : ""}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="questions" disabled={busy} data-variant="secondary" className={tabClass}>
              <MessageCircleQuestion size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Questions des exercices
              <span className="tabular-nums text-sm font-normal">{loaded ? `${questionsCount}/${QUESTION_KINDS.length}` : ""}</span>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="letters" className="space-y-4 focus-visible:outline-none">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="max-w-[65ch] text-sm text-ms-muted">
                Joué dans les exercices « choisir le son », « retrouver la lettre » et « écrire ». Tant qu&apos;une lettre
                n&apos;a pas de son, la voix de l&apos;appareil la prononce.
              </p>
              {loaded && <RecordedProgress recorded={lettersCount} total={ARABIC_ALPHABET.length} tone="slate" />}
            </div>
            {loaded
              ? <AudioLibraryPanel items={letterEntries} pinnedKey={activeKey} renderRow={renderRow} searchLabel="Rechercher une lettre" listLabel="Lettres de l'alphabet" />
              : <div className="ms-panel"><SkeletonRows rows={6} label="Chargement des sons" /></div>}
          </Tabs.Content>

          <Tabs.Content value="questions" className="space-y-4 focus-visible:outline-none">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="max-w-[65ch] text-sm text-ms-muted">
                Lisez chaque question à voix haute. Dans une leçon, l&apos;élève l&apos;entend quand l&apos;exercice apparaît,
                et peut la réécouter. Sans enregistrement, la question reste seulement écrite.
              </p>
              {loaded && <RecordedProgress recorded={questionsCount} total={QUESTION_KINDS.length} tone="blush" />}
            </div>
            {loaded
              ? <AudioLibraryPanel items={questionEntries} pinnedKey={activeKey} renderRow={renderRow} searchLabel="Rechercher une question" listLabel="Questions des exercices" />
              : <div className="ms-panel"><SkeletonRows rows={3} label="Chargement des sons" /></div>}
          </Tabs.Content>
        </Tabs.Root>

        <RecordingTips>
          <li>Pour une lettre, dites son <strong>son</strong> (« ba »), pas son nom (« bâ&apos; »).</li>
          <li>Appuyez sur « Enregistrer le son », parlez, puis sur « Arrêter » tout de suite : court, sans silence.</li>
          <li>L&apos;enregistrement est sauvegardé dès l&apos;arrêt. Écoutez-le, puis remplacez l&apos;audio au besoin.</li>
        </RecordingTips>
      </div>
    </TeacherShell>
  );
}
