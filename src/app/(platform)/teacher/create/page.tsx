"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Trash2, Save, ArrowLeft, HelpCircle, Shuffle, Layers,
  Mic, Square, Play, CheckCircle, ImagePlus, X, Type, Image, LayoutGrid,
  Video, Plus, BookOpen, ChevronUp, ChevronDown, Copy, AlignJustify, Upload,
} from "lucide-react";
import { uploadMedia, externalizeMediaToR2 } from "@/lib/mediaUpload";
import { fetchLesson, createLesson, updateLesson } from "@/lib/lessonsApi";

/* ── Types ── */
interface SlideItem { id: string; imageDataUrl: string; text?: string; audioDataUrl?: string; audioDuration?: number; }
type ExerciseType = "quiz" | "matching" | "dragdrop" | "wordorder";
type AnswerMode = "image" | "text" | "both";
interface QuizOption { id: string; text: string; imageDataUrl?: string; }
interface QuizExercise {
  type: "quiz"; question: string; options: QuizOption[];
  correctId: string; audioDataUrl?: string; answerMode: AnswerMode;
}
interface MatchPair { id: string; left: string; right: string; }
interface MatchExercise { type: "matching"; pairs: MatchPair[]; }
interface DragItem { id: string; text: string; category: string; }
interface DragCategory { id: string; label: string; }
interface DragExercise { type: "dragdrop"; items: DragItem[]; categories: DragCategory[]; }
interface WordOrderExercise { type: "wordorder"; sentence: string; audioDataUrl?: string; answerAudioDataUrl?: string; }
type Exercise = QuizExercise | MatchExercise | DragExercise | WordOrderExercise;

type VideoBlock     = { id: string; type: "video";     url: string; title: string; }
type SlideshowBlock = { id: string; type: "slideshow"; slides: SlideItem[]; }
type ExerciseBlock  = { id: string; type: "exercise";  exercise: Exercise; }
type ContentBlock   = VideoBlock | SlideshowBlock | ExerciseBlock;

/* ── Config ── */
const exerciseTypeConfig = {
  quiz:      { icon: HelpCircle,   label: "Quiz à choix multiple", color: "#f9a875" },
  matching:  { icon: Shuffle,      label: "Appariement",           color: "#95d5b2" },
  dragdrop:  { icon: Layers,       label: "Glisser–déposer",       color: "#74c2e8" },
  wordorder: { icon: AlignJustify, label: "Mots dans l'ordre",     color: "#ffb4a2" },
};

const blockMeta: Record<ContentBlock["type"], { label: string; color: string }> = {
  video:     { label: "Vidéo",            color: "#74c2e8" },
  slideshow: { label: "Leçon illustrée",  color: "#c9b1e8" },
  exercise:  { label: "Exercice",         color: "#f9a875" },
};

const answerModes: { value: AnswerMode; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }[] = [
  { value: "image", icon: Image,      label: "Images"   },
  { value: "text",  icon: Type,       label: "Texte"    },
  { value: "both",  icon: LayoutGrid, label: "Les deux" },
];

function uid() { return Math.random().toString(36).slice(2, 8); }

// Voice-only constraints + recorder options: mono, low bitrate Opus.
// ~32 kbps mono Opus = clear speech at roughly 1/4 the size of default WebM.
const VOICE_CONSTRAINTS: MediaStreamConstraints = {
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
};
function makeVoiceRecorder(stream: MediaStream): MediaRecorder {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
  const opts: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
  if (mimeType) opts.mimeType = mimeType;
  return new MediaRecorder(stream, opts);
}

function makeExercise(type: ExerciseType): Exercise {
  if (type === "quiz") return {
    type: "quiz", question: "", correctId: "", answerMode: "image",
    options: [{ id: uid(), text: "" }, { id: uid(), text: "" }, { id: uid(), text: "" }],
  };
  if (type === "matching") return {
    type: "matching",
    pairs: [{ id: uid(), left: "", right: "" }, { id: uid(), left: "", right: "" }],
  };
  if (type === "wordorder") return { type: "wordorder", sentence: "" };
  return {
    type: "dragdrop",
    items: [{ id: uid(), text: "", category: "a" }],
    categories: [{ id: "a", label: "Catégorie A" }, { id: "b", label: "Catégorie B" }],
  };
}

/* ════════════════════════════════════════════
   Main component
════════════════════════════════════════════ */
function CreateLessonPageInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const editId      = searchParams.get("edit");

  const [title,  setTitle]  = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  /* ── Load for edit ── */
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const lesson = await fetchLesson(editId);
      if (!lesson) return;
      setTitle(lesson.title);
      setBlocks(lesson.blocks as ContentBlock[]);
    })();
  }, [editId]);

  /* ── Recording state ── */
  type ExerciseAudioField = "audioDataUrl" | "answerAudioDataUrl";
  const [recordingBlockId,  setRecordingBlockId]  = useState<string | null>(null);
  const [recordingSlideIdx, setRecordingSlideIdx] = useState<number | null>(null);
  const [recordingField,    setRecordingField]    = useState<ExerciseAudioField | null>(null);
  const [recDuration,       setRecDuration]       = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartTime  = useRef(0);
  const recordTargetRef  = useRef<{ blockId: string; slideIdx?: number; field?: ExerciseAudioField } | null>(null);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingBlockId(null);
    setRecordingSlideIdx(null);
    setRecordingField(null);
    setRecDuration(0);
  };

  const startExerciseAudioRecording = async (blockId: string, field: ExerciseAudioField = "audioDataUrl") => {
    if (recordingBlockId !== null) return;
    try {
      const stream   = await navigator.mediaDevices.getUserMedia(VOICE_CONSTRAINTS);
      const recorder = makeVoiceRecorder(stream);
      chunksRef.current = [];
      recordTargetRef.current = { blockId, field };
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const target = recordTargetRef.current!;
        const blob   = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          setBlocks((prev) => prev.map((b) => {
            if (b.id !== target.blockId || b.type !== "exercise") return b;
            const key = target.field ?? "audioDataUrl";
            return { ...b, exercise: { ...b.exercise, [key]: reader.result as string } as Exercise };
          }));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingBlockId(blockId);
      setRecordingField(field);
      setRecDuration(0);
      timerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
    } catch {
      alert("Impossible d'accéder au microphone. Vérifiez les permissions.");
    }
  };

  const deleteExerciseAudio = (blockId: string, field: ExerciseAudioField = "audioDataUrl") => {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId || b.type !== "exercise") return b;
      return { ...b, exercise: { ...b.exercise, [field]: undefined } as Exercise };
    }));
  };

  const startSlideRecording = async (blockId: string, slideIdx: number) => {
    if (recordingBlockId !== null) return;
    try {
      const stream   = await navigator.mediaDevices.getUserMedia(VOICE_CONSTRAINTS);
      const recorder = makeVoiceRecorder(stream);
      chunksRef.current = [];
      recordTargetRef.current = { blockId, slideIdx };
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const target   = recordTargetRef.current!;
        const duration = Date.now() - recordStartTime.current;
        const blob     = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader   = new FileReader();
        reader.onload = () => {
          setBlocks((prev) => prev.map((b) => {
            if (b.id !== target.blockId || b.type !== "slideshow") return b;
            return { ...b, slides: b.slides.map((s, i) =>
              i === target.slideIdx
                ? { ...s, audioDataUrl: reader.result as string, audioDuration: duration }
                : s
            )};
          }));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recordStartTime.current = Date.now();
      mediaRecorderRef.current = recorder;
      setRecordingBlockId(blockId);
      setRecordingSlideIdx(slideIdx);
      setRecDuration(0);
      timerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
    } catch {
      alert("Impossible d'accéder au microphone. Vérifiez les permissions.");
    }
  };

  const deleteSlideAudio = (blockId: string, slideIdx: number) => {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId || b.type !== "slideshow") return b;
      return { ...b, slides: b.slides.map((s, i) =>
        i === slideIdx ? { ...s, audioDataUrl: undefined, audioDuration: undefined } : s
      )};
    }));
  };

  /* ── Video upload (R2) ── */
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const handleVideoFile = async (blockId: string, file: File) => {
    if (uploadingBlockId !== null) return;
    if (file.size > 200 * 1024 * 1024) { setError("Vidéo trop lourde (200 MB maximum)."); return; }
    setError("");
    setUploadingBlockId(blockId);
    setUploadPct(0);
    try {
      const url = await uploadMedia(file, setUploadPct);
      setBlocks((prev) => prev.map((b) =>
        b.id === blockId && b.type === "video" ? { ...b, url } : b
      ));
    } catch (err) {
      setError(`Téléversement impossible : ${(err as Error).message}`);
    } finally {
      setUploadingBlockId(null);
    }
  };

  /* ── Block operations ── */
  const addBlock = (type: "video" | "slideshow" | ExerciseType) => {
    if (type === "video") {
      setBlocks((p) => [...p, { id: uid(), type: "video", url: "", title: "" }]);
    } else if (type === "slideshow") {
      setBlocks((p) => [...p, { id: uid(), type: "slideshow", slides: [{ id: uid(), imageDataUrl: "" }] }]);
    } else {
      setBlocks((p) => [...p, { id: uid(), type: "exercise", exercise: makeExercise(type) }]);
    }
  };

  const removeBlock = (id: string) => setBlocks((p) => p.filter((b) => b.id !== id));

  const duplicateBlock = (id: string) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i === -1) return prev;
      const original = prev[i] as ExerciseBlock;
      const copy: ExerciseBlock = { ...original, id: uid(), exercise: JSON.parse(JSON.stringify(original.exercise)) };
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i + dir < 0 || i + dir >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  };

  const updateBlock = (id: string, updater: (b: ContentBlock) => ContentBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? updater(b) : b)));

  const updateExercise = (blockId: string, updater: (ex: Exercise) => Exercise) =>
    updateBlock(blockId, (b) => b.type === "exercise" ? { ...b, exercise: updater(b.exercise) } : b);

  const updateQuiz = (blockId: string, updater: (q: QuizExercise) => QuizExercise) =>
    updateExercise(blockId, (ex) => updater(ex as QuizExercise));

  /* ── Save ── */
  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError("Veuillez donner un titre à la leçon."); return; }
    const quizMissingAnswer = blocks.some(
      (b) => b.type === "exercise" && b.exercise.type === "quiz" && !(b.exercise as QuizExercise).correctId
    );
    if (quizMissingAnswer) { setError("Marquez la bonne réponse pour chaque exercice quiz."); return; }

    setSaving(true);
    try {
      // Les images/audios encore inline partent vers R2 ; la base ne reçoit
      // que du JSON avec des URLs.
      const cleanBlocks = (await externalizeMediaToR2(blocks)) as unknown[];
      if (editId) await updateLesson(editId, title.trim(), cleanBlocks);
      else await createLesson(title.trim(), cleanBlocks);
      router.push("/teacher?published=1");
    } catch (err) {
      setError(`Erreur lors de la sauvegarde : ${(err as Error).message || "inconnue"}.`);
      setSaving(false);
    }
  };

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  /* ══════════════════════════════════════════
     Render
  ══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#fffef9]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/teacher" className="flex items-center gap-2 text-gray-600 hover:text-[#f9a875] transition-colors">
          <ArrowLeft size={18} /> Retour
        </Link>
        <h1 className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          {editId ? "Modifier la leçon" : "Créer une leçon"}
        </h1>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#BB908E] text-white rounded-full font-bold text-sm hover:bg-[#a87e7c] hover:shadow-md transition-all disabled:opacity-60">
          <Save size={14} /> {saving ? "Publication…" : "Sauvegarder"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">

        {/* Title */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-[#2d2d2d] mb-4">Informations de la leçon</h2>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Titre *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Les animaux de la forêt"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#f9a875] focus:ring-2 focus:ring-[#f9a875]/20 outline-none"
          />
        </div>

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-semibold">Aucun bloc — ajoutez des vidéos, leçons ou exercices ci-dessous.</p>
          </div>
        )}

        {/* Blocks */}
        {blocks.map((block, bi) => {
          const meta  = blockMeta[block.type];
          const isFirst = bi === 0;
          const isLast  = bi === blocks.length - 1;

          return (
            <div key={block.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Block header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100"
                style={{ background: `${meta.color}12` }}>
                <div className="flex items-center gap-2">
                  {block.type === "video"     && <Video    size={15} style={{ color: meta.color }} />}
                  {block.type === "slideshow" && <BookOpen size={15} style={{ color: meta.color }} />}
                  {block.type === "exercise"  && (() => {
                    const cfg = exerciseTypeConfig[(block as ExerciseBlock).exercise.type as ExerciseType];
                    return <cfg.icon size={15} style={{ color: cfg.color }} />;
                  })()}
                  <span className="text-sm font-bold" style={{ color: meta.color }}>
                    {block.type === "exercise"
                      ? exerciseTypeConfig[(block as ExerciseBlock).exercise.type as ExerciseType].label
                      : meta.label}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">· bloc {bi + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  {block.type === "exercise" && (
                    <button onClick={() => duplicateBlock(block.id)}
                      title="Dupliquer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#f9a875] hover:bg-[#fff8ee] transition-colors">
                      <Copy size={13} />
                    </button>
                  )}
                  <button onClick={() => moveBlock(block.id, -1)} disabled={isFirst}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveBlock(block.id, 1)} disabled={isLast}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => removeBlock(block.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* ── VIDEO block body ── */}
              {block.type === "video" && (
                <div className="p-4 space-y-2">
                  <input
                    value={(block as VideoBlock).title}
                    onChange={(e) => updateBlock(block.id, (b) => ({ ...(b as VideoBlock), title: e.target.value }))}
                    placeholder="Titre de la vidéo (optionnel)"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#74c2e8] outline-none text-sm"
                  />
                  <input
                    value={(block as VideoBlock).url}
                    onChange={(e) => updateBlock(block.id, (b) => ({ ...(b as VideoBlock), url: e.target.value }))}
                    placeholder="URL YouTube ou lien vidéo direct..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#74c2e8] outline-none text-sm font-mono"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-gray-400 font-semibold">ou</span>
                    {uploadingBlockId === block.id ? (
                      <span className="text-xs font-bold text-[#74c2e8] animate-pulse">
                        Téléversement… {uploadPct}%
                      </span>
                    ) : (
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#74c2e8] text-white text-xs font-bold shadow-sm transition-all ${
                        uploadingBlockId !== null ? "opacity-40 cursor-not-allowed" : "hover:bg-[#5eb2de] hover:shadow-md cursor-pointer"
                      }`}>
                        <Upload size={12} /> Téléverser un fichier vidéo
                        <input type="file" accept="video/*" className="hidden" disabled={uploadingBlockId !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoFile(block.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* ── SLIDESHOW block body ── */}
              {block.type === "slideshow" && (
                <div className="p-4 space-y-4">
                  {(block as SlideshowBlock).slides.map((slide, si) => (
                    <div key={slide.id} className="border-2 border-gray-100 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-sm font-bold text-gray-600">Diapo {si + 1}</span>
                        <button
                          onClick={() => updateBlock(block.id, (b) => ({
                            ...(b as SlideshowBlock),
                            slides: (b as SlideshowBlock).slides.filter((_, i) => i !== si),
                          }))}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="p-4 space-y-3">
                       <div className="flex gap-4">
                        {/* Image */}
                        <div className="w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 relative">
                          {slide.imageDataUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={slide.imageDataUrl} alt={`Diapo ${si + 1}`} className="w-full h-full object-cover" />
                              <button
                                onClick={() => updateBlock(block.id, (b) => ({
                                  ...(b as SlideshowBlock),
                                  slides: (b as SlideshowBlock).slides.map((s, i) =>
                                    i === si ? { ...s, imageDataUrl: "" } : s
                                  ),
                                }))}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors">
                                <X size={10} />
                              </button>
                            </>
                          ) : (
                            <label htmlFor={`slide-img-${slide.id}`}
                              className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-100 transition-colors">
                              <ImagePlus size={20} className="text-gray-400" />
                              <span className="text-xs text-gray-400">Image</span>
                            </label>
                          )}
                          <input id={`slide-img-${slide.id}`} type="file" accept="image/*" className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => updateBlock(block.id, (b) => ({
                                ...(b as SlideshowBlock),
                                slides: (b as SlideshowBlock).slides.map((s, i) =>
                                  i === si ? { ...s, imageDataUrl: reader.result as string } : s
                                ),
                              }));
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }}
                          />
                        </div>

                        {/* Audio */}
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Audio associé</p>
                          {(() => {
                            const isRec = recordingBlockId === block.id && recordingSlideIdx === si;
                            return (
                              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all ${
                                isRec ? "border-red-300 bg-red-50/60"
                                : slide.audioDataUrl ? "border-[#c9b1e8]/50 bg-[#f8f4ff]"
                                : "border-dashed border-gray-200 bg-gray-50/50"
                              }`}>
                                <Mic size={16} className={isRec ? "text-red-500" : slide.audioDataUrl ? "text-[#c9b1e8]" : "text-gray-400"} />
                                <span className="text-xs font-semibold text-gray-500 flex-1">
                                  {isRec ? "Enregistrement en cours…"
                                    : slide.audioDataUrl
                                    ? `Audio enregistré${slide.audioDuration ? ` · ${(slide.audioDuration / 1000).toFixed(1)}s` : ""}`
                                    : "Enregistrer un audio (optionnel)"}
                                </span>
                                {isRec ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                                      ● {fmtDuration(recDuration)}
                                    </span>
                                    <button onClick={stopRecording}
                                      className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                                      <Square size={12} fill="white" />
                                    </button>
                                  </div>
                                ) : slide.audioDataUrl ? (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle size={15} className="text-[#c9b1e8]" />
                                    <button onClick={() => new Audio(slide.audioDataUrl!).play()}
                                      className="w-8 h-8 rounded-full bg-[#c9b1e8]/20 text-[#c9b1e8] flex items-center justify-center hover:bg-[#c9b1e8]/40 transition-colors">
                                      <Play size={12} fill="currentColor" />
                                    </button>
                                    <button onClick={() => deleteSlideAudio(block.id, si)}
                                      className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 transition-colors">
                                      <Trash2 size={12} />
                                    </button>
                                    <button onClick={() => startSlideRecording(block.id, si)} disabled={recordingBlockId !== null}
                                      className="text-xs font-semibold text-gray-500 hover:text-[#c9b1e8] transition-colors disabled:opacity-40">
                                      Ré-enregistrer
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startSlideRecording(block.id, si)} disabled={recordingBlockId !== null}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6B705C] text-white text-xs font-bold shadow-sm hover:bg-[#5b6050] hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Mic size={12} /> Enregistrer
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                       </div>

                       {/* Texte sous l'image (optionnel) */}
                       <div>
                         <p className="text-xs font-semibold text-gray-500 mb-1.5">Texte sous l&apos;image (optionnel)</p>
                         <textarea
                           value={slide.text ?? ""}
                           onChange={(e) => updateBlock(block.id, (b) => ({
                             ...(b as SlideshowBlock),
                             slides: (b as SlideshowBlock).slides.map((s, i) =>
                               i === si ? { ...s, text: e.target.value } : s
                             ),
                           }))}
                           placeholder="Texte affiché sous l'image…"
                           rows={2}
                           className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#c9b1e8] focus:ring-2 focus:ring-[#c9b1e8]/20 outline-none text-sm resize-y"
                         />
                       </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => updateBlock(block.id, (b) => ({
                      ...(b as SlideshowBlock),
                      slides: [...(b as SlideshowBlock).slides, { id: uid(), imageDataUrl: "" }],
                    }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c9b1e8]/10 text-[#c9b1e8] text-xs font-bold hover:bg-[#c9b1e8]/20 transition-colors">
                    <Plus size={14} /> Ajouter une diapo
                  </button>
                </div>
              )}

              {/* ── EXERCISE block body ── */}
              {block.type === "exercise" && (() => {
                const ex  = (block as ExerciseBlock).exercise;
                const cfg = exerciseTypeConfig[ex.type as ExerciseType];

                return (
                  <div className="p-6 space-y-4">
                    {/* QUIZ */}
                    {ex.type === "quiz" && (() => {
                      const quiz = ex as QuizExercise;
                      const isRec = recordingBlockId === block.id && recordingSlideIdx === null && recordingField === "audioDataUrl";
                      return (
                        <div className="space-y-4">
                          {/* Question */}
                          <input
                            value={quiz.question}
                            onChange={(e) => updateQuiz(block.id, (q) => ({ ...q, question: e.target.value }))}
                            placeholder="Question..."
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-[#f9a875] outline-none"
                          />

                          {/* Audio recorder */}
                          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all ${
                            isRec ? "border-red-300 bg-red-50/60"
                            : quiz.audioDataUrl ? "border-[#95d5b2]/50 bg-[#f0faf5]"
                            : "border-dashed border-gray-200 bg-gray-50/50"
                          }`}>
                            <Mic size={16} className={isRec ? "text-red-500" : quiz.audioDataUrl ? "text-[#95d5b2]" : "text-gray-400"} />
                            <span className="text-xs font-semibold text-gray-500 flex-1">
                              {isRec ? "Enregistrement en cours…" : quiz.audioDataUrl ? "Audio enregistré" : "Audio de la question (optionnel)"}
                            </span>
                            {isRec ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                                  ● {fmtDuration(recDuration)}
                                </span>
                                <button onClick={stopRecording}
                                  className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                                  <Square size={12} fill="white" />
                                </button>
                              </div>
                            ) : quiz.audioDataUrl ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle size={15} className="text-[#95d5b2]" />
                                <button onClick={() => new Audio(quiz.audioDataUrl!).play()}
                                  className="w-8 h-8 rounded-full bg-[#95d5b2]/20 text-[#95d5b2] flex items-center justify-center hover:bg-[#95d5b2]/40 transition-colors">
                                  <Play size={12} fill="currentColor" />
                                </button>
                                <button onClick={() => deleteExerciseAudio(block.id)}
                                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                                <button onClick={() => startExerciseAudioRecording(block.id)} disabled={recordingBlockId !== null}
                                  className="text-xs font-semibold text-gray-500 hover:text-[#f9a875] transition-colors disabled:opacity-40">
                                  Ré-enregistrer
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startExerciseAudioRecording(block.id)} disabled={recordingBlockId !== null}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6B705C] text-white text-xs font-bold shadow-sm hover:bg-[#5b6050] hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                <Mic size={12} /> Enregistrer
                              </button>
                            )}
                          </div>

                          {/* Answer mode */}
                          <div>
                            <p className="text-xs text-gray-400 font-semibold mb-2">Type de réponses</p>
                            <div className="flex gap-2">
                              {answerModes.map(({ value, icon: Icon, label }) => (
                                <button key={value}
                                  onClick={() => updateQuiz(block.id, (q) => ({ ...q, answerMode: value }))}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                                    quiz.answerMode === value
                                      ? "border-[#f9a875] bg-[#fff8ee] text-[#f9a875]"
                                      : "border-gray-200 bg-white text-gray-500 hover:border-[#f9a875]/50"
                                  }`}>
                                  <Icon size={14} /> {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Options */}
                          <div>
                            <p className="text-xs text-gray-400 font-semibold mb-2">
                              Réponses — cliquez sur &quot;Marquer correcte&quot; pour choisir la bonne réponse *
                            </p>
                            <div className="flex gap-3">
                              {quiz.options.map((opt, oi) => {
                                const isCorrect = quiz.correctId === opt.id;
                                const showImage = quiz.answerMode === "image" || quiz.answerMode === "both";
                                const showText  = quiz.answerMode === "text"  || quiz.answerMode === "both";
                                return (
                                  <div key={opt.id}
                                    className={`flex-1 rounded-2xl border-2 overflow-hidden transition-all ${isCorrect ? "border-[#95d5b2] shadow-md" : "border-gray-200"}`}>
                                    {showImage && (
                                      <div className="relative bg-gray-50 aspect-square">
                                        {opt.imageDataUrl ? (
                                          <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={opt.imageDataUrl} alt={opt.text || `Réponse ${oi + 1}`} className="w-full h-full object-cover" />
                                            <button
                                              onClick={() => updateQuiz(block.id, (q) => ({
                                                ...q, options: q.options.map((o, idx) => idx === oi ? { ...o, imageDataUrl: undefined } : o),
                                              }))}
                                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors">
                                              <X size={12} />
                                            </button>
                                          </>
                                        ) : (
                                          <label htmlFor={`img-${opt.id}`}
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-100 transition-colors">
                                            <ImagePlus size={22} className="text-gray-400" />
                                            <span className="text-xs text-gray-400 font-medium">Image</span>
                                          </label>
                                        )}
                                        <input id={`img-${opt.id}`} type="file" accept="image/*" className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = () => updateQuiz(block.id, (q) => ({
                                              ...q, options: q.options.map((o, idx) =>
                                                idx === oi ? { ...o, imageDataUrl: reader.result as string } : o
                                              ),
                                            }));
                                            reader.readAsDataURL(file);
                                            e.target.value = "";
                                          }}
                                        />
                                      </div>
                                    )}
                                    {showText && (
                                      <div className="px-2 pt-2 bg-white">
                                        <input
                                          value={opt.text}
                                          onChange={(e) => updateQuiz(block.id, (q) => ({
                                            ...q, options: q.options.map((o, idx) => idx === oi ? { ...o, text: e.target.value } : o),
                                          }))}
                                          placeholder={`Réponse ${oi + 1}`}
                                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:border-[#f9a875] outline-none"
                                        />
                                      </div>
                                    )}
                                    <button
                                      onClick={() => updateQuiz(block.id, (q) => ({ ...q, correctId: opt.id }))}
                                      className={`w-full mt-1.5 py-2 text-xs font-bold rounded-b-2xl transition-all ${
                                        isCorrect ? "bg-[#95d5b2] text-white" : "bg-gray-100 text-gray-400 hover:bg-[#95d5b2]/20 hover:text-[#5cb88a]"
                                      }`}>
                                      {isCorrect ? "✓ Bonne réponse" : "Marquer correcte"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* MATCHING */}
                    {ex.type === "matching" && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-400 font-semibold">Paires à associer</p>
                        {(ex as MatchExercise).pairs.map((pair, pi) => (
                          <div key={pair.id} className="flex items-center gap-2">
                            <input value={pair.left}
                              onChange={(e) => updateExercise(block.id, (ex) => {
                                const m = { ...(ex as MatchExercise) };
                                m.pairs = m.pairs.map((p, idx) => idx === pi ? { ...p, left: e.target.value } : p);
                                return m;
                              })}
                              placeholder="Gauche" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 outline-none text-sm" />
                            <span className="text-gray-400">↔</span>
                            <input value={pair.right}
                              onChange={(e) => updateExercise(block.id, (ex) => {
                                const m = { ...(ex as MatchExercise) };
                                m.pairs = m.pairs.map((p, idx) => idx === pi ? { ...p, right: e.target.value } : p);
                                return m;
                              })}
                              placeholder="Droite" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 outline-none text-sm" />
                          </div>
                        ))}
                        <button onClick={() => updateExercise(block.id, (ex) => {
                          const m = { ...(ex as MatchExercise) };
                          m.pairs = [...m.pairs, { id: uid(), left: "", right: "" }];
                          return m;
                        })} className="text-sm font-semibold hover:underline" style={{ color: cfg.color }}>
                          + Ajouter une paire
                        </button>
                      </div>
                    )}

                    {/* DRAGDROP */}
                    {ex.type === "dragdrop" && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-400 font-semibold">Éléments à classer</p>
                        {(ex as DragExercise).items.map((item, ii) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <input value={item.text}
                              onChange={(e) => updateExercise(block.id, (ex) => {
                                const d = { ...(ex as DragExercise) };
                                d.items = d.items.map((it, idx) => idx === ii ? { ...it, text: e.target.value } : it);
                                return d;
                              })}
                              placeholder="Élément" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 outline-none text-sm" />
                            <select value={item.category}
                              onChange={(e) => updateExercise(block.id, (ex) => {
                                const d = { ...(ex as DragExercise) };
                                d.items = d.items.map((it, idx) => idx === ii ? { ...it, category: e.target.value } : it);
                                return d;
                              })}
                              className="px-3 py-2 rounded-xl border border-gray-200 outline-none text-sm">
                              {(ex as DragExercise).categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                          </div>
                        ))}
                        <button onClick={() => updateExercise(block.id, (ex) => {
                          const d = { ...(ex as DragExercise) };
                          d.items = [...d.items, { id: uid(), text: "", category: "a" }];
                          return d;
                        })} className="text-sm font-semibold hover:underline" style={{ color: cfg.color }}>
                          + Ajouter un élément
                        </button>
                      </div>
                    )}

                    {/* WORDORDER */}
                    {ex.type === "wordorder" && (() => {
                      const w = ex as WordOrderExercise;
                      const words = w.sentence.split(/\s+/).filter(Boolean);
                      const isRecInstr  = recordingBlockId === block.id && recordingSlideIdx === null && recordingField === "audioDataUrl";
                      const isRecAnswer = recordingBlockId === block.id && recordingSlideIdx === null && recordingField === "answerAudioDataUrl";
                      const renderAudioRow = (
                        field: ExerciseAudioField,
                        isRec: boolean,
                        audioUrl: string | undefined,
                        emptyLabel: string,
                        filledLabel: string,
                      ) => (
                        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all ${
                          isRec ? "border-red-300 bg-red-50/60"
                          : audioUrl ? "border-[#95d5b2]/50 bg-[#f0faf5]"
                          : "border-dashed border-gray-200 bg-gray-50/50"
                        }`}>
                          <Mic size={16} className={isRec ? "text-red-500" : audioUrl ? "text-[#95d5b2]" : "text-gray-400"} />
                          <span className="text-xs font-semibold text-gray-500 flex-1">
                            {isRec ? "Enregistrement en cours…" : audioUrl ? filledLabel : emptyLabel}
                          </span>
                          {isRec ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                                ● {fmtDuration(recDuration)}
                              </span>
                              <button onClick={stopRecording}
                                className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                                <Square size={12} fill="white" />
                              </button>
                            </div>
                          ) : audioUrl ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle size={15} className="text-[#95d5b2]" />
                              <button onClick={() => new Audio(audioUrl).play()}
                                className="w-8 h-8 rounded-full bg-[#95d5b2]/20 text-[#95d5b2] flex items-center justify-center hover:bg-[#95d5b2]/40 transition-colors">
                                <Play size={12} fill="currentColor" />
                              </button>
                              <button onClick={() => deleteExerciseAudio(block.id, field)}
                                className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 transition-colors">
                                <Trash2 size={12} />
                              </button>
                              <button onClick={() => startExerciseAudioRecording(block.id, field)} disabled={recordingBlockId !== null}
                                className="text-xs font-semibold text-gray-500 hover:text-[#ffb4a2] transition-colors disabled:opacity-40">
                                Ré-enregistrer
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startExerciseAudioRecording(block.id, field)} disabled={recordingBlockId !== null}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ background: cfg.color }}>
                              <Mic size={12} /> Enregistrer
                            </button>
                          )}
                        </div>
                      );
                      return (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-400 font-semibold">
                            Phrase modèle — l&apos;élève devra remettre les mots dans l&apos;ordre
                          </p>
                          <input
                            value={w.sentence}
                            onChange={(e) => updateExercise(block.id, (ex) => ({ ...(ex as WordOrderExercise), sentence: e.target.value }))}
                            placeholder="Ex : Le chat mange une souris"
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#ffb4a2]"
                          />

                          {/* Audio recorder — énoncé dicté par l'enseignant */}
                          {renderAudioRow(
                            "audioDataUrl",
                            isRecInstr,
                            w.audioDataUrl,
                            "Énoncé dicté (optionnel) — votre voix lira la consigne",
                            "Énoncé enregistré",
                          )}

                          {/* Audio recorder — réponse lue à la bonne réponse */}
                          {renderAudioRow(
                            "answerAudioDataUrl",
                            isRecAnswer,
                            w.answerAudioDataUrl,
                            "Réponse lue (optionnel) — votre voix lira la phrase correcte",
                            "Réponse enregistrée",
                          )}

                          {words.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-400 font-semibold mb-2">Aperçu des mots</p>
                              <div className="flex flex-wrap gap-2">
                                {words.map((word, i) => (
                                  <span key={i}
                                    className="px-3 py-1.5 rounded-full text-xs font-bold"
                                    style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                    {word}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {/* Add block */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-dashed border-gray-200">
          <h3 className="font-bold text-gray-600 mb-4">Ajouter un bloc</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={() => addBlock("video")}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all hover:scale-105"
              style={{ borderColor: "#74c2e850", background: "#74c2e808" }}>
              <Video size={22} className="text-[#74c2e8]" />
              <span className="text-xs font-bold text-gray-600">Vidéo</span>
            </button>
            <button onClick={() => addBlock("slideshow")}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all hover:scale-105"
              style={{ borderColor: "#c9b1e850", background: "#c9b1e808" }}>
              <BookOpen size={22} className="text-[#c9b1e8]" />
              <span className="text-xs font-bold text-gray-600">Leçon illustrée</span>
            </button>
            {(Object.entries(exerciseTypeConfig) as [ExerciseType, typeof exerciseTypeConfig[ExerciseType]][]).map(([type, cfg]) => (
              <button key={type} onClick={() => addBlock(type)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all hover:scale-105"
                style={{ borderColor: `${cfg.color}50`, background: `${cfg.color}08` }}>
                <cfg.icon size={22} style={{ color: cfg.color }} />
                <span className="text-xs font-bold text-gray-600 text-center">{cfg.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-5 py-3 font-semibold">
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 rounded-2xl bg-[#8BA3B1] text-white font-black text-lg flex items-center justify-center gap-2 hover:bg-[#789dad] hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60 disabled:scale-100">
          <Save size={20} /> {saving ? "Sauvegarde…" : editId ? "Sauvegarder les modifications" : "Publier la leçon"}
        </button>
      </div>
    </div>
  );
}

export default function CreateLessonPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-float">⏳</div></div>}>
      <CreateLessonPageInner />
    </Suspense>
  );
}
