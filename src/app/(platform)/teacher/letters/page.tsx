"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Square, Play, CheckCircle, Trash2, Loader2 } from "lucide-react";
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

const ARABIC_FONT = { fontFamily: "'Noto Naskh Arabic', 'Cairo', serif" };

/** Ce qu'on enregistre : le son d'une lettre ou la question d'un exercice. */
type Target = { letterId: number } | { question: QuestionKind };
const keyOf = (t: Target) => ("letterId" in t ? `l${t.letterId}` : `q${t.question}`);

/**
 * Sons enregistrés par un admin, communs à toute la plateforme :
 * - le son de chaque lettre, joué dans l'exercice « choisir le son » ;
 * - la question de chaque exercice de lettres, lue à l'élève quand
 *   l'exercice apparaît dans une leçon.
 * Chaque enregistrement est converti en MP3, téléversé sur R2 et enregistré
 * dès l'arrêt du micro.
 */
export default function LetterSoundsPage() {
  const [sounds, setSounds] = useState<Sounds>({ letters: {}, questions: {} });
  const [loaded, setLoaded] = useState(false);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setUrl(t, url);
    } catch (e) {
      setError(`${name} : enregistrement non sauvegardé (${e instanceof Error ? e.message : "erreur inconnue"}).`);
    } finally {
      setSavingFor(null);
    }
  };

  const startRecording = async (t: Target, name: string) => {
    setError(null);
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
    } catch {
      setError("Impossible d'accéder au microphone. Vérifiez les permissions de votre navigateur.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingFor(null);
  };

  const remove = async (t: Target, name: string, replacement: string) => {
    if (!confirm(`Supprimer l'enregistrement « ${name} » ? ${replacement}`)) return;
    setError(null);
    try {
      await deleteSound(t);
      setUrl(t, undefined);
    } catch (e) {
      setError(`${name} : suppression impossible (${e instanceof Error ? e.message : "erreur inconnue"}).`);
    }
  };

  const busy = recordingFor !== null || savingFor !== null;

  /** Une ligne : ce qu'il faut dire, puis écouter / supprimer / enregistrer. */
  const row = (t: Target, name: string, replacement: string, content: ReactNode) => {
    const key = keyOf(t);
    const url = urlOf(t);
    const isRecording = recordingFor === key;
    return (
      <div key={key}
        className={`bg-white rounded-2xl p-3 border-2 shadow-sm transition-all flex items-center justify-between gap-3 ${
          isRecording ? "border-red-300 bg-red-50/60" : url ? "border-[#6B705C]/30" : "border-gray-100"
        }`}>
        <div className="flex items-center gap-3 min-w-0">
          {content}
          {url && <CheckCircle size={14} className="text-[#6B705C] shrink-0" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRecording ? (
            <>
              <span className="text-xs font-mono font-bold text-red-500 bg-red-100 px-2 py-1 rounded-full animate-pulse">
                ● 0:{String(duration).padStart(2, "0")}
              </span>
              <button onClick={stopRecording} title="Arrêter et sauvegarder"
                className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow">
                <Square size={14} fill="white" />
              </button>
            </>
          ) : savingFor === key ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Sauvegarde…
            </span>
          ) : (
            <>
              {url && (
                <>
                  <button onClick={() => new Audio(url).play()} title="Écouter"
                    className="w-9 h-9 rounded-full bg-[#6B705C]/10 text-[#6B705C] flex items-center justify-center hover:bg-[#6B705C]/20 transition-colors">
                    <Play size={14} fill="currentColor" />
                  </button>
                  <button onClick={() => remove(t, name, replacement)} disabled={busy} title="Supprimer"
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-40">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button onClick={() => startRecording(t, name)} disabled={busy || !loaded}
                title={url ? "Ré-enregistrer" : "Enregistrer"}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  url ? "bg-gray-100 text-gray-600 hover:bg-[#6B705C]/10 hover:text-[#6B705C]" : "bg-[#6B705C] text-white shadow hover:shadow-md"
                }`}>
                <Mic size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const lettersCount = ARABIC_ALPHABET.filter((l) => sounds.letters[l.id]).length;
  const questionsCount = QUESTION_KINDS.filter((k) => sounds.questions[k]).length;

  return (
    <div className="min-h-screen bg-[#fffef9]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/teacher" className="flex items-center gap-2 text-gray-500 hover:text-[#BB908E] transition-colors">
          <ArrowLeft size={18} /> Tableau de bord
        </Link>
        <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Sons des lettres
        </span>
        <span className="w-24" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <p className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{error}</p>
        )}

        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-xl font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Questions des exercices
            </h2>
            <span className="text-sm font-bold text-[#6B705C]">{questionsCount}/{QUESTION_KINDS.length}</span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Lisez chaque question à voix haute. Dans une leçon, l&apos;élève l&apos;entend quand l&apos;exercice
            apparaît, et peut la réécouter. Sans enregistrement, la question reste seulement écrite.
          </p>
          <div className="space-y-3">
            {QUESTION_KINDS.map((kind) => {
              const { arabic, label } = QUESTIONS[kind];
              return row({ question: kind }, label, "La question restera seulement écrite.", (
                <div className="min-w-0">
                  <p className="text-xl font-bold text-[#2d2d2d] leading-snug" style={{ ...ARABIC_FONT, direction: "rtl" }}>{arabic}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ));
            })}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-xl font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Son de chaque lettre
            </h2>
            <span className="text-sm font-bold text-[#6B705C]">{lettersCount}/{ARABIC_ALPHABET.length}</span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Joué dans les exercices « choisir le son », « retrouver la lettre » et « écrire ». Tant
            qu&apos;une lettre n&apos;a pas de son, la voix de l&apos;appareil la prononce.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {ARABIC_ALPHABET.map((letter) =>
              row({ letterId: letter.id }, letter.nameTranslit, "La voix de l'appareil la remplacera.", (
                <>
                  <span className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-3xl"
                    style={{ ...ARABIC_FONT, color: letter.color, background: `${letter.color}1A` }}>
                    {letter.isolated}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#2d2d2d]">{letter.nameTranslit}</p>
                    <p className="text-xs text-gray-500">
                      Son : <span style={ARABIC_FONT}>{spokenSound(letter)}</span> · {letter.id}
                    </p>
                  </div>
                </>
              )),
            )}
          </div>
        </section>

        <div className="mt-8 bg-[#fff8ee] rounded-2xl p-5 border border-[#ffd166]/30">
          <p className="font-bold text-[#8b6f47] mb-2">Conseils pour un bon enregistrement</p>
          <ul className="space-y-1 text-sm text-[#8b6f47]">
            <li>• Pour une lettre, dites son <strong>son</strong> (« ba »), pas son nom (« bâ&apos; »).</li>
            <li>• Appuyez sur le micro, parlez, puis arrêtez tout de suite : court, sans silence.</li>
            <li>• L&apos;enregistrement est sauvegardé dès l&apos;arrêt ; écoutez-le avec ▶ et ré-enregistrez au besoin.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
