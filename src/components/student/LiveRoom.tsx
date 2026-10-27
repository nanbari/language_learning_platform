"use client";
import { type ReactNode } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Radio, X } from "lucide-react";

import type { Participant } from "@/lib/liveSession";
import type { LiveClass } from "@/lib/classes";

import { useLiveGuest, useLiveLink } from "@/hooks/useLiveSession";
import { useVideoCall } from "@/hooks/useLiveVideo";
import { SlideView } from "@/components/present/Slides";
import { CallButtons, SoundUnlock, VideoTile } from "@/components/present/VideoCall";
import { STUDENT_ICON } from "@/components/student/StudentShell";
import { BackToLessons } from "@/components/student/BackToLessons";

const STROKE = 1.75;

/** État calme de la salle, sans image décorative ni promesse d'horaire. */
function RoomMessage({ tone, title, text, busy = false, action }: {
  tone: "slate" | "sage"; title: string; text?: string; busy?: boolean; action?: ReactNode;
}) {
  const Icon = tone === "sage" ? Check : Radio;
  return (
    <section role="status" aria-busy={busy} className="mx-auto w-full max-w-[32rem] rounded-3xl border border-ms-line bg-ms-surface p-6 text-center sm:p-8">
      <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${tone === "sage" ? "bg-ms-sage-soft text-ms-sage-ink" : "bg-ms-slate-soft text-ms-slate-ink"}`}>
        <Icon size={32} strokeWidth={STROKE} aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold leading-8">{title}</h1>
      {text && <p className="mt-1 text-ms-muted">{text}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  );
}

export function LiveRoom({ code, info, me, onLeave }: { code: string; info: LiveClass; me: Participant; onLeave: () => void }) {
  // Ce que l'élève sait vraiment du cours : son groupe et, s'il est connu, l'enseignant. Pas d'horaire inventé.
  const context = info.teacherName ? `${info.name}, avec ${info.teacherName}` : info.name;
  const link = useLiveLink(info.id, code);
  const { state, status, sendAnswer } = useLiveGuest(info.id, code, link);
  const call = useVideoCall(info.id, code, { ...me, role: "student" }, link);
  const teacher = call.peers.find((p) => p.role === "teacher");
  const classmates = call.peers.filter((p) => p.role !== "teacher");
  const live = status === "live" && !!state;
  const ended = status === "ended" || status === "denied";

  return (
    <div data-ms-app="" data-ms-area="student" className="flex min-h-dvh flex-col bg-ms-canvas text-ms-ink select-none">
      <header className="flex min-h-20 flex-wrap items-center gap-x-3 gap-y-2 border-b border-ms-line bg-ms-surface px-4 py-2 sm:px-6">
        <button type="button" onClick={onLeave} data-variant="quiet" className="ms-button text-ms-muted">
          <X size={STUDENT_ICON} strokeWidth={STROKE} aria-hidden="true" /> Quitter
        </button>
        <p className="min-w-0 flex-1 text-center text-lg font-bold tabular-nums" aria-live="polite">
          {live && state ? `Activité ${state.index + 1} sur ${state.total}` : ""}
        </p>
        {!ended && (
          <div className="flex flex-wrap items-center gap-2">
            <SoundUnlock />
            <CallButtons cam={call.cam} mic={call.mic} onCam={call.toggleCam} onMic={call.toggleMic} disabled={!call.local} hideLabelsOnMobile />
          </div>
        )}
      </header>

      <div className={`grid flex-1 min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 ${ended ? "" : "lg:grid-cols-[minmax(0,1fr)_16rem]"}`}>
        {/* Scène partagée : la même que celle de l'enseignant, sans ses repères ni le décompte des réponses */}
        <main id="contenu" className="flex min-h-[60vh] min-w-0 overflow-auto px-4 py-4 sm:px-6 lg:min-h-0">
          <div className="m-auto w-full min-w-0">
            {status === "denied" ? (
              <RoomMessage tone="slate" title="Ce cours ne t'est pas ouvert." text="Demande à ton enseignant de t'ajouter à la classe." action={<BackToLessons variant="primary" />} />
            ) : ended ? (
              <RoomMessage tone="sage" title="Le cours est terminé" text={`${context}. À bientôt.`} action={<BackToLessons variant="primary" />} />
            ) : status === "waiting" && !state ? (
              <RoomMessage tone="slate" title="Le cours n'a pas encore commencé." text={`${context}. Tu es dans la salle : ça démarrera ici.`} action={<BackToLessons />} />
            ) : !live || !state ? (
              <RoomMessage tone="slate" title="Connexion au cours…" text={context} busy />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.index}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                  className="w-full"
                >
                  <SlideView
                    slide={state.slide}
                    step={state.step}
                    game={{
                      revealed: state.revealed,
                      onPick: (choiceId) => sendAnswer(state.index, choiceId),
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>

        {/* Vidéo : à côté de la scène (en dessous sur téléphone), jamais par-dessus les réponses */}
        {!ended && (
          <aside aria-label="Vidéo du cours" className="min-w-0 border-t border-ms-line bg-ms-surface px-4 py-3 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:py-4">
            {call.error && <p role="alert" className="mb-3 rounded-2xl bg-ms-danger-soft px-4 py-3 text-base text-ms-danger">{call.error}</p>}
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
              {teacher && (
                <li className="w-44 shrink-0 lg:col-span-2 lg:w-auto">
                  <VideoTile stream={teacher.stream} name={teacher.name} cam={teacher.cam} mic={teacher.mic} />
                </li>
              )}
              <li className="w-24 shrink-0 lg:w-auto">
                <VideoTile stream={call.local} name={me.name} cam={call.cam} mic={call.mic} self unavailable={!!call.error} compact />
              </li>
              {classmates.map((p) => (
                <li key={p.session} className="w-24 shrink-0 lg:w-auto">
                  <VideoTile stream={p.stream} name={p.name} cam={p.cam} mic={p.mic} compact />
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
