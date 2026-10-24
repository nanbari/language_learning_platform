"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Radio, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { Participant } from "@/lib/liveSession";
import type { LiveClass } from "@/lib/classes";
import { fetchLiveClasses } from "@/lib/classesApi";
import { useLiveGuest } from "@/lib/useLiveSession";
import { useVideoCall } from "@/lib/useLiveVideo";
import { SlideView } from "@/components/present/Slides";
import { CallButtons, SoundUnlock, VideoTile } from "@/components/present/VideoCall";

/** Fréquence de vérification des cours lancés dans les classes de l'élève. */
const POLL_MS = 5000;

export default function StudentLivePage() {
  const { user } = useAuthStore();
  const [joined, setJoined] = useState<LiveClass | null>(null);

  if (joined && user) {
    return <LiveRoom code={joined.room} me={{ id: user.id, name: user.name }} onLeave={() => setJoined(null)} />;
  }
  return <LiveList onJoin={setJoined} />;
}

/** Les cours en direct des classes de l'élève ; la liste se met à jour toute seule. */
function LiveList({ onJoin }: { onJoin: (live: LiveClass) => void }) {
  const [lives, setLives] = useState<LiveClass[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => fetchLiveClasses()
      .then((list) => { if (active) { setLives(list); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    void check();
    const timer = setInterval(check, POLL_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return (
    <div className="min-h-screen bg-[#F5EEE8] flex flex-col">
      <div className="px-4 py-3">
        <Link href="/student" className="inline-flex items-center gap-2 text-[#2D2D2D]/50 hover:text-[#BB908E] font-semibold transition-colors">
          <ArrowLeft size={18} /> Mon espace
        </Link>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24 text-center">
        <span className="text-7xl animate-float mb-4">🎬</span>
        <h1 className="text-3xl text-[#2D2D2D] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Cours en direct
        </h1>
        {lives === null ? (
          <p className="text-[#2D2D2D]/60 font-semibold">{failed ? "Connexion impossible, nouvel essai…" : "Chargement…"}</p>
        ) : lives.length === 0 ? (
          <p className="text-[#2D2D2D]/60 font-semibold max-w-sm">
            Pas de cours en direct pour le moment. Reste sur cette page : le bouton apparaîtra dès que ton enseignant lancera le cours.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 mt-4">
            {lives.map((live) => (
              <button
                key={live.id}
                onClick={() => onJoin(live)}
                className="flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg text-white shadow hover:shadow-md hover:scale-105 transition-all"
                style={{ background: "#BB908E" }}
              >
                <Radio size={20} className="animate-pulse" />
                Rejoindre « {live.name} »
                {live.teacherName && <span className="font-semibold opacity-80 text-base">avec {live.teacherName}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Waiting({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="text-[20vmin] leading-none animate-float mb-[3vmin]">{emoji}</div>
      <h1 className="text-[7vmin] text-[#2D2D2D]" style={{ fontFamily: "'Fredoka One', cursive" }}>{title}</h1>
      <p className="text-[3.4vmin] font-bold text-[#2D2D2D]/50">{text}</p>
    </div>
  );
}

function LiveRoom({ code, me, onLeave }: { code: string; me: Participant; onLeave: () => void }) {
  const { state, status, sendAnswer } = useLiveGuest(code, me);
  const call = useVideoCall(code, { ...me, role: "student" });
  const teacher = call.peers.find((p) => p.role === "teacher");
  const classmates = call.peers.filter((p) => p.role !== "teacher");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5EEE8] overflow-hidden select-none">
      <div className="flex items-center justify-between px-4 py-2 text-sm font-bold text-[#2D2D2D]/50">
        <button onClick={onLeave} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:text-red-400 hover:bg-red-50 transition-colors">
          <X size={16} /> Quitter
        </button>
        {status === "live" && state && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: state.total }, (_, i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all"
                style={{ width: i === state.index ? 22 : 8, background: i <= state.index ? "#BB908E" : "#CCB9B5" + "60" }}
              />
            ))}
          </div>
        )}
        <CallButtons cam={call.cam} mic={call.mic} onCam={call.toggleCam} onMic={call.toggleMic} disabled={!call.local} />
      </div>

      {call.error && <p className="text-center text-sm font-bold text-[#BB908E] px-4">{call.error}</p>}
      <SoundUnlock />

      {/* Marge à droite pour la colonne des vignettes */}
      <div className="flex-1 flex items-center justify-center pl-4 pr-[max(7rem,calc(17vmin+2rem))]">
        {status === "ended" ? (
          <Waiting emoji="👋" title="Le cours est terminé" text="À bientôt !" />
        ) : status !== "live" || !state ? (
          <Waiting
            emoji="⏳"
            title={status === "connecting" ? "Connexion…" : "On attend ton enseignant"}
            text="Le cours va bientôt commencer"
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={state.index}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <SlideView
                slide={state.slide}
                step={state.step}
                game={{
                  revealed: state.revealed,
                  onPick: (choiceId, correct) => sendAnswer(state.index, choiceId, correct),
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {status !== "ended" && (
        <>
          {/* L'enseignant en bas à gauche, en grand */}
          {teacher && (
            <VideoTile
              stream={teacher.stream}
              name={teacher.name}
              cam={teacher.cam}
              mic={teacher.mic}
              className="fixed left-4 bottom-4 z-[60] w-[34vmin] min-w-40 max-w-80"
            />
          )}
          {/* Soi-même et les camarades, en petit à droite */}
          <div className="fixed right-4 top-16 bottom-4 z-[60] w-[17vmin] min-w-24 max-w-40 flex flex-col gap-2 overflow-y-auto pointer-events-none">
            <VideoTile stream={call.local} name={me.name} cam={call.cam} mic={call.mic} self />
            {classmates.map((p) => (
              <VideoTile key={p.session} stream={p.stream} name={p.name} cam={p.cam} mic={p.mic} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
