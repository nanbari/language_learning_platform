"use client";
import { VocabPicture } from "@/components/student/VocabPicture";
import { useState, useRef, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Apple, Hand, Hash, Palette, PawPrint, School, TreePine, UsersRound, BookOpen, type LucideIcon } from "lucide-react";
import TeacherShell from "@/components/teacher/TeacherShell";
import { useTeacherSession } from "@/components/teacher/useTeacherSession";
import { Button, ICON_STROKE, InlineNotice, SkeletonRows } from "@/components/platform/ui";
import { uploadMedia } from "@/lib/mediaUpload";
import { needsMp3Transcode, transcodeToMp3 } from "@/lib/audioTranscode";
import { INSTRUCTION_ID, deleteVocabSound, loadVocabSounds, saveVocabSound, type VocabSounds } from "@/lib/vocabSound";
import { playSound } from "@/lib/soundPlayer";
import AudioRecorderRow, { micErrorMessage, type RecorderPhase } from "@/components/teacher/audio/AudioRecorderRow";
import { AudioLibraryPanel, RecordedProgress, RecordingTips } from "@/components/teacher/audio/AudioLibraryPanel";
import { VOCAB_THEMES, VocabTheme, ArabicWord } from "@/data/arabicVocabulary";

/** Icône de chaque thème de vocabulaire (à la place de l'émoji du thème). */
const THEME_ICONS: Record<string, LucideIcon> = {
  animals: PawPrint,
  colors: Palette,
  numbers: Hash,
  family: UsersRound,
  body: Hand,
  food: Apple,
  nature: TreePine,
  school: School,
};

const TONES = ["slate", "sage", "blush"] as const;
const TONE_TILE: Record<(typeof TONES)[number], string> = {
  slate: "bg-ms-slate-soft text-ms-slate-ink",
  sage: "bg-ms-sage-soft text-ms-sage-ink",
  blush: "bg-ms-blush-soft text-ms-blush-ink",
};

/** Anciens enregistrements, gardés dans ce navigateur avant que la plateforme ne les stocke. */
const legacyKey = (theme: VocabTheme, word: ArabicWord) => `ms_arabic_audio_${theme.id}_${word.id}`;

/** Envoie un enregistrement vers R2 (en mp3, lisible partout) et l'associe au mot sur la plateforme. */
async function publishRecording(wordId: string, blob: Blob): Promise<string> {
  let audio = blob;
  if (needsMp3Transcode(audio.type)) {
    try { audio = await transcodeToMp3(audio); } catch { /* format d'origine, plutôt que perdre la voix */ }
  }
  const ext = audio.type.includes("mpeg") ? "mp3" : audio.type.includes("ogg") ? "ogg" : "webm";
  const url = await uploadMedia(new File([audio], `vocab-${wordId}.${ext}`, { type: audio.type || "audio/webm" }));
  await saveVocabSound(wordId, url);
  return url;
}

interface WordEntry { key: string; word: ArabicWord; hasAudio: boolean; search: string }

/**
 * Enregistrements audio du vocabulaire : pour chaque mot, la question
 * « أَيْنَ … ؟ » lue par l'enseignant, et la consigne de l'exercice. Les
 * fichiers vont sur R2 et leur adresse dans vocab_sounds (/api/vocab-sounds) :
 * les élèves les entendent sur tous leurs appareils. Les enregistrements
 * faits avant dans ce navigateur peuvent être envoyés en une fois.
 */
export default function TeacherArabicPage() {
  const { user, isAdmin, handleLogout } = useTeacherSession();
  const [activeTheme, setActiveTheme] = useState<VocabTheme>(VOCAB_THEMES[0]);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [requestingFor, setRequestingFor] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Sons enregistrés sur la plateforme ({ id du mot: URL }) ; null avant lecture. */
  const [sounds, setSounds] = useState<VocabSounds | null>(null);
  /** Anciens enregistrements encore dans ce navigateur : { clé localStorage: id du mot }. */
  const [legacy, setLegacy] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    const found: Record<string, string> = {};
    try {
      VOCAB_THEMES.forEach((theme) => theme.words.forEach((word) => {
        if (localStorage.getItem(legacyKey(theme, word))) found[legacyKey(theme, word)] = word.id;
      }));
    } catch { /* stockage inaccessible : rien à migrer */ }
    return found;
  });
  const [migrating, setMigrating] = useState<{ done: number; total: number; error?: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    loadVocabSounds().then((s) => { if (active) setSounds(s); });
    return () => { active = false; };
  }, []);

  /** Envoie vers la plateforme les enregistrements encore dans ce navigateur, un par un ; chacun n'est retiré d'ici qu'une fois enregistré là-bas. */
  const migrateLegacy = async () => {
    const entries = Object.entries(legacy);
    setMigrating({ done: 0, total: entries.length });
    let done = 0;
    for (const [key, wordId] of entries) {
      try {
        const dataUrl = localStorage.getItem(key);
        if (!dataUrl) continue;
        const blob = await (await fetch(dataUrl)).blob();
        const url = await publishRecording(wordId, blob);
        setSounds((prev) => ({ ...(prev ?? {}), [wordId]: url }));
        localStorage.removeItem(key);
        done += 1;
        setMigrating({ done, total: entries.length });
      } catch (e) {
        setMigrating({ done, total: entries.length, error: (e as Error).message });
        return;
      }
    }
    setLegacy({});
    setMigrating(null);
  };

  const startRecording = async (word: Pick<ArabicWord, "id">) => {
    setError(null);
    setSavedFor(null);
    setRequestingFor(word.id);
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
        setSavingFor(word.id);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        // « Enregistré » seulement une fois le serveur d'accord ; sinon l'ancien enregistrement reste en place.
        publishRecording(word.id, blob)
          .then((url) => { setSounds((prev) => ({ ...(prev ?? {}), [word.id]: url })); setSavedFor(word.id); })
          .catch((e: Error) => setError({ key: word.id, text: `Enregistrement non sauvegardé : ${e.message}. L'enregistrement précédent est conservé.` }))
          .finally(() => setSavingFor(null));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingFor(word.id);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      setError({ key: word.id, text: micErrorMessage(e) });
    } finally {
      setRequestingFor(null);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingFor(null);
    setDuration(0);
  };

  const playRecording = (word: Pick<ArabicWord, "id">) => {
    const url = sounds?.[word.id];
    if (url) void playSound(url);
  };

  const deleteRecording = async (word: Pick<ArabicWord, "id">) => {
    setSavedFor(null);
    setError(null);
    try {
      await deleteVocabSound(word.id);
      setSounds((prev) => { const next = { ...(prev ?? {}) }; delete next[word.id]; return next; });
    } catch (e) {
      setError({ key: word.id, text: `Suppression impossible : ${(e as Error).message}` });
    }
  };

  const busy = recordingFor !== null || requestingFor !== null || savingFor !== null;
  const activeKey = requestingFor ?? recordingFor ?? savingFor;

  const phaseOf = (key: string): RecorderPhase =>
    requestingFor === key ? "requesting"
      : recordingFor === key ? "recording"
        : savingFor === key ? "uploading"
          : error?.key === key ? "error"
            : savedFor === key ? "saved" : "idle";

  const savedKeys = sounds ? new Set(Object.keys(sounds)) : null;
  const countFor = (theme: VocabTheme) => theme.words.filter((w) => savedKeys?.has(w.id)).length;
  const legacyCount = Object.keys(legacy).length;

  const entries: WordEntry[] = activeTheme.words.map((word) => ({
    key: word.id,
    word,
    hasAudio: !!savedKeys?.has(word.id),
    search: `${word.french} ${word.translit} ${word.arabic}`,
  }));

  const renderRow = ({ key, word, hasAudio }: WordEntry) => (
    <AudioRecorderRow
      key={key}
      id={`voc-${activeTheme.id}-${key}`}
      name={word.french}
      leading={
        <span aria-hidden="true" className="block h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-ms-line bg-ms-surface [&_span]:text-xl">
          <VocabPicture word={word} sizes="3rem" />
        </span>
      }
      title={<span lang="ar" dir="rtl" className="ms-arabic block text-xl">أَيْنَ {word.arabic}؟</span>}
      subtitle={<>Où est {word.french}&nbsp;? · {word.translit}</>}
      hasAudio={hasAudio}
      phase={phaseOf(key)}
      elapsed={duration}
      error={error?.key === key ? error.text : null}
      expanded={expanded === key}
      onToggle={() => setExpanded((k) => (k === key ? null : key))}
      locked={busy}
      onRecord={() => startRecording(word)}
      onStop={stopRecording}
      onPlay={() => playRecording(word)}
      onDelete={() => deleteRecording(word)}
      deleteHint="L'élève n'entendra plus votre voix pour ce mot."
    />
  );

  const themeIndex = VOCAB_THEMES.findIndex((t) => t.id === activeTheme.id);
  const tabClass =
    "ms-button data-[state=active]:!bg-ms-primary-soft data-[state=active]:!text-ms-primary data-[state=active]:!border-ms-primary";

  return (
    <TeacherShell name={user?.name || "Enseignant"} isAdmin={isAdmin} onLogout={handleLogout}>
      <div className="space-y-6">
        <header>
          <h1 className="text-[1.75rem] leading-9 lg:text-[2rem] lg:leading-10 font-semibold tracking-[-0.02em]">Enregistrements audio</h1>
          <p className="mt-1 text-ms-muted max-w-[65ch]">
            Enregistrez votre voix pour la consigne et pour chaque question du vocabulaire. Les enregistrements sont
            gardés sur la plateforme : les élèves les entendent sur tous leurs appareils.
          </p>
        </header>

        {legacyCount > 0 && (
          <InlineNotice action={
            <Button variant="primary" onClick={() => void migrateLegacy()} disabled={!!migrating && !migrating.error}>
              {migrating && !migrating.error ? `Envoi… ${migrating.done}/${migrating.total}` : "Envoyer aux élèves"}
            </Button>
          }>
            <p className="font-semibold">{legacyCount} enregistrement{legacyCount > 1 ? "s" : ""} encore dans ce navigateur</p>
            <p>Faits avant que la plateforme ne garde les sons, ils n&apos;ont jamais atteint les élèves. Envoyez-les une fois : chacun est retiré d&apos;ici seulement quand il est bien enregistré là-bas.</p>
            {migrating?.error && <p role="alert" className="mt-1 text-ms-danger">Arrêté après {migrating.done} : {migrating.error}</p>}
          </InlineNotice>
        )}

        {/* La consigne, commune à tous les thèmes : lue à l'élève en arrivant sur l'exercice. */}
        <section aria-labelledby="consigne-h" className="ms-panel">
          <h2 id="consigne-h" className="sr-only">Consigne de l&apos;exercice</h2>
          {savedKeys ? (
            <AudioRecorderRow
              id="voc-instruction"
              name="la consigne"
              leading={<span aria-hidden="true" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-ms-sage-soft text-ms-sage-ink"><BookOpen size={22} strokeWidth={ICON_STROKE} /></span>}
              title={<span className="text-lg font-semibold">Consigne : « Écoute, puis choisis l&apos;image. »</span>}
              subtitle="Lue une fois au début de l'exercice, avant la première question."
              hasAudio={savedKeys.has(INSTRUCTION_ID)}
              phase={phaseOf(INSTRUCTION_ID)}
              elapsed={duration}
              error={error?.key === INSTRUCTION_ID ? error.text : null}
              expanded={expanded === INSTRUCTION_ID}
              onToggle={() => setExpanded((k) => (k === INSTRUCTION_ID ? null : INSTRUCTION_ID))}
              locked={busy}
              onRecord={() => startRecording({ id: INSTRUCTION_ID })}
              onStop={stopRecording}
              onPlay={() => playRecording({ id: INSTRUCTION_ID })}
              onDelete={() => deleteRecording({ id: INSTRUCTION_ID })}
              deleteHint="L'exercice commencera sans consigne parlée."
            />
          ) : <SkeletonRows rows={1} label="Chargement de la consigne" />}
        </section>

        <Tabs.Root
          value={activeTheme.id}
          onValueChange={(id) => {
            const theme = VOCAB_THEMES.find((t) => t.id === id);
            if (theme && !busy) { setActiveTheme(theme); setExpanded(null); setError(null); setSavedFor(null); }
          }}
          className="space-y-5"
        >
          <Tabs.List aria-label="Thèmes du vocabulaire" className="flex flex-wrap gap-2">
            {VOCAB_THEMES.map((t) => {
              const Icon = THEME_ICONS[t.id] ?? BookOpen;
              return (
                <Tabs.Trigger key={t.id} value={t.id} disabled={busy} data-variant="secondary" className={tabClass}>
                  <Icon size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {t.nameFrench}
                  {savedKeys && <span className="tabular-nums text-sm font-normal">{countFor(t)}/{t.words.length}</span>}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>

          <Tabs.Content value={activeTheme.id} className="space-y-4 focus-visible:outline-none">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="flex items-center gap-3 text-xl leading-7 font-semibold">
                {(() => {
                  const Icon = THEME_ICONS[activeTheme.id] ?? BookOpen;
                  const tone = TONES[Math.max(themeIndex, 0) % TONES.length];
                  return (
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_TILE[tone]}`}>
                      <Icon size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    </span>
                  );
                })()}
                {activeTheme.nameFrench}
                <span lang="ar" dir="rtl" className="ms-arabic text-lg font-normal text-ms-muted">{activeTheme.nameArabic}</span>
              </h2>
              {savedKeys && (
                <RecordedProgress recorded={countFor(activeTheme)} total={activeTheme.words.length} tone={TONES[Math.max(themeIndex, 0) % TONES.length]} />
              )}
            </div>
            {savedKeys
              ? <AudioLibraryPanel key={activeTheme.id} items={entries} pinnedKey={activeKey} renderRow={renderRow} searchLabel="Rechercher un mot" listLabel={`Mots : ${activeTheme.nameFrench}`} />
              : <div className="ms-panel"><SkeletonRows rows={6} label="Chargement des enregistrements" /></div>}
          </Tabs.Content>
        </Tabs.Root>

        <RecordingTips>
          <li>Parlez clairement et d&apos;une voix douce.</li>
          <li>Lisez la question en arabe : <span lang="ar" dir="rtl" className="ms-arabic">أَيْنَ [mot]؟</span></li>
          <li>Les enregistrements sont gardés sur la plateforme et lus aux élèves sur tous leurs appareils.</li>
          <li>Écoutez l&apos;enregistrement pour le vérifier, puis remplacez l&apos;audio au besoin.</li>
        </RecordingTips>
      </div>
    </TeacherShell>
  );
}
