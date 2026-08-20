"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Square, Play, CheckCircle, Trash2 } from "lucide-react";
import { VOCAB_THEMES, VocabTheme, ArabicWord } from "@/data/arabicVocabulary";

export default function TeacherArabicPage() {
  const [activeTheme, setActiveTheme] = useState<VocabTheme>(VOCAB_THEMES[0]);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const keys = new Set<string>();
    activeTheme.words.forEach((word) => {
      if (localStorage.getItem(`ms_arabic_audio_${activeTheme.id}_${word.id}`)) {
        keys.add(word.id);
      }
    });
    setSavedKeys(keys);
  }, [activeTheme]);

  const startRecording = async (word: ArabicWord) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
      const opts: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
      if (mimeType) opts.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, opts);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          localStorage.setItem(
            `ms_arabic_audio_${activeTheme.id}_${word.id}`,
            reader.result as string
          );
          setSavedKeys((prev) => new Set([...prev, word.id]));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingFor(word.id);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert("Impossible d'accéder au microphone. Vérifiez les permissions de votre navigateur.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingFor(null);
    setDuration(0);
  };

  const playRecording = (word: ArabicWord) => {
    const stored = localStorage.getItem(`ms_arabic_audio_${activeTheme.id}_${word.id}`);
    if (stored) new Audio(stored).play();
  };

  const deleteRecording = (word: ArabicWord) => {
    localStorage.removeItem(`ms_arabic_audio_${activeTheme.id}_${word.id}`);
    setSavedKeys((prev) => {
      const s = new Set(prev);
      s.delete(word.id);
      return s;
    });
  };

  const recordedCount = savedKeys.size;
  const progress = Math.round((recordedCount / activeTheme.words.length) * 100);

  return (
    <div className="min-h-screen bg-[#fffef9]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/teacher" className="flex items-center gap-2 text-gray-500 hover:text-[#f9a875] transition-colors">
          <ArrowLeft size={18} /> Tableau de bord
        </Link>
        <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          🎙️ Enregistrements audio
        </span>
        <div className="text-sm font-semibold text-gray-500">
          {recordedCount}/{activeTheme.words.length} enregistrés
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#2d2d2d] mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Audio — Vocabulaire arabe
          </h1>
          <p className="text-gray-500 text-sm">
            Enregistrez votre voix pour chaque question. L&apos;élève entendra votre enregistrement lors de l&apos;exercice.
          </p>
        </div>

        {/* Theme tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {VOCAB_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { if (!recordingFor) setActiveTheme(t); }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTheme.id === t.id
                  ? "text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#f9a875]"
              } ${recordingFor ? "opacity-50 cursor-not-allowed" : ""}`}
              style={activeTheme.id === t.id ? { background: activeTheme.color } : {}}
            >
              {t.emoji} {t.nameFrench}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-100">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-600">{activeTheme.nameFrench}</span>
            <span className="font-bold" style={{ color: activeTheme.color }}>
              {progress}% — {recordedCount}/{activeTheme.words.length}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: activeTheme.color }}
            />
          </div>
        </div>

        {/* Word list */}
        <div className="space-y-3">
          {activeTheme.words.map((word) => {
            const isRecording = recordingFor === word.id;
            const isSaved = savedKeys.has(word.id);

            return (
              <div
                key={word.id}
                className={`bg-white rounded-2xl p-4 border-2 shadow-sm transition-all ${
                  isRecording
                    ? "border-red-300 bg-red-50/60"
                    : isSaved
                    ? "border-[#95d5b2]/50"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Word info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-3xl shrink-0">{word.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-black text-[#2d2d2d] text-lg"
                          style={{ fontFamily: "'Cairo', sans-serif", direction: "rtl" }}
                        >
                          أَيْنَ {word.arabic}؟
                        </span>
                        {isSaved && <CheckCircle size={16} className="text-[#95d5b2] shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500">Où est {word.french}&nbsp;?</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isRecording ? (
                      <>
                        <span className="text-xs font-mono font-bold text-red-500 bg-red-100 px-2 py-1 rounded-full animate-pulse">
                          ●&nbsp;
                          {String(Math.floor(duration / 60)).padStart(2, "0")}:
                          {String(duration % 60).padStart(2, "0")}
                        </span>
                        <button
                          onClick={stopRecording}
                          className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow"
                          title="Arrêter"
                        >
                          <Square size={14} fill="white" />
                        </button>
                      </>
                    ) : (
                      <>
                        {isSaved && (
                          <>
                            <button
                              onClick={() => playRecording(word)}
                              className="w-9 h-9 rounded-full bg-[#95d5b2]/20 text-[#95d5b2] flex items-center justify-center hover:bg-[#95d5b2]/40 transition-colors"
                              title="Écouter"
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                            <button
                              onClick={() => deleteRecording(word)}
                              className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => startRecording(word)}
                          disabled={!!recordingFor}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            isSaved
                              ? "bg-gray-100 text-gray-600 hover:bg-[#6B705C]/10 hover:text-[#6B705C]"
                              : "bg-[#6B705C] text-white shadow hover:bg-[#5b6050] hover:shadow-md"
                          }`}
                        >
                          <Mic size={14} />
                          {isSaved ? "Ré-enregistrer" : "Enregistrer"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        <div className="mt-8 bg-[#fff8ee] rounded-2xl p-5 border border-[#ffd166]/30">
          <p className="font-bold text-[#8b6f47] mb-2">💡 Conseils pour un bon enregistrement</p>
          <ul className="space-y-1 text-sm text-[#8b6f47]">
            <li>• Parlez clairement et à voix douce</li>
            <li>• Lisez la question en arabe : <span style={{ fontFamily: "'Cairo', sans-serif" }}>«&nbsp;أَيْنَ [mot]&nbsp;؟&nbsp;»</span></li>
            <li>• Les enregistrements sont sauvegardés dans ce navigateur</li>
            <li>• Cliquez sur ▶ pour vérifier l&apos;enregistrement avant de valider</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
