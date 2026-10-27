"use client";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ContentBlock, Exercise, ExerciseAudioField } from "@/components/teacher/builder/model";
import { exerciseAudioKey, slideAudioKey, type RecorderView } from "@/components/teacher/builder/BlockEditors";

/**
 * Enregistrement de la voix de l'enseignant dans l'éditeur de leçon : un seul
 * micro à la fois, pour la consigne d'un exercice ou une diapositive. L'audio
 * est gardé en data: URL dans le bloc ; il part vers R2 à l'enregistrement de
 * la leçon (lib/mediaUpload). Extrait de la page pour la garder lisible.
 */

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

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  return name === "NotAllowedError" || name === "SecurityError"
    ? "Autorisez le microphone dans votre navigateur pour enregistrer."
    : "Le micro n'a pas pu démarrer. Vérifiez qu'il est branché, puis réessayez.";
}

/** Largeur d'écran, pour n'afficher l'aperçu qu'une fois (colonne, panneau ou onglet). */

export function useVoiceRecorder(setBlocks: Dispatch<SetStateAction<ContentBlock[]>>) {
  /* ── Recording state ── */
  const [recordingBlockId,  setRecordingBlockId]  = useState<string | null>(null);
  const [recordingSlideIdx, setRecordingSlideIdx] = useState<number | null>(null);
  const [recordingField,    setRecordingField]    = useState<ExerciseAudioField | null>(null);
  const [recDuration,       setRecDuration]       = useState(0);
  /** Emplacement dont on attend l'autorisation du micro, et dernière erreur du micro. */
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [micError, setMicError] = useState<{ key: string; message: string } | null>(null);
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
    const key = exerciseAudioKey(blockId, field);
    setMicError(null);
    setPendingKey(key);
    try {
      const stream   = await navigator.mediaDevices.getUserMedia(VOICE_CONSTRAINTS);
      const recorder = makeVoiceRecorder(stream);
      chunksRef.current = [];
      recordTargetRef.current = { blockId, field };
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const target = recordTargetRef.current!;
        const blob   = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
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
    } catch (err) {
      setMicError({ key, message: micErrorMessage(err) });
    } finally {
      setPendingKey(null);
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
    const key = slideAudioKey(blockId, slideIdx);
    setMicError(null);
    setPendingKey(key);
    try {
      const stream   = await navigator.mediaDevices.getUserMedia(VOICE_CONSTRAINTS);
      const recorder = makeVoiceRecorder(stream);
      chunksRef.current = [];
      recordTargetRef.current = { blockId, slideIdx };
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const target   = recordTargetRef.current!;
        const duration = Date.now() - recordStartTime.current;
        const blob     = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
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
      // L'horodatage part au vrai démarrage de l'enregistreur, dans son propre rappel.
      recorder.onstart = () => { recordStartTime.current = Date.now(); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingBlockId(blockId);
      setRecordingSlideIdx(slideIdx);
      setRecDuration(0);
      timerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
    } catch (err) {
      setMicError({ key, message: micErrorMessage(err) });
    } finally {
      setPendingKey(null);
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

  const recordingKey = recordingBlockId === null ? null
    : recordingSlideIdx !== null ? slideAudioKey(recordingBlockId, recordingSlideIdx)
    : exerciseAudioKey(recordingBlockId, recordingField ?? "audioDataUrl");

  const recorder: RecorderView = {
    stateFor: (key, hasAudio) =>
      key === recordingKey ? "recording" : key === pendingKey ? "requesting" : hasAudio ? "recorded" : "idle",
    errorFor: (key) => (micError?.key === key ? micError.message : null),
    elapsed: recDuration,
    busy: recordingBlockId !== null || pendingKey !== null,
    stop: stopRecording,
  };

  return { recorder, startExerciseAudioRecording, startSlideRecording, deleteExerciseAudio, deleteSlideAudio };
}
