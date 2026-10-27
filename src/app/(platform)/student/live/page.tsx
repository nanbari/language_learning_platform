"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { Radio } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

import type { LiveClass } from "@/lib/classes";
import { fetchLiveClasses } from "@/lib/api/classes";

import StudentShell from "@/components/student/StudentShell";
import { BackToLessons } from "@/components/student/BackToLessons";

/** Fréquence de vérification des cours lancés dans les classes de l'élève. */
const POLL_MS = 5000;
const STROKE = 1.75;

// La salle (vidéo WebRTC, diapositives animées) n'est chargée qu'en rejoignant un cours.
const LiveRoom = dynamic(() => import("@/components/student/LiveRoom").then((m) => m.LiveRoom), {
  ssr: false,
  loading: () => <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas" aria-busy="true" />,
});

export default function StudentLivePage() {
  const { user } = useAuthStore();
  const [joined, setJoined] = useState<LiveClass | null>(null);

  if (joined && user) {
    return <LiveRoom code={joined.room} info={joined} me={{ id: user.id, name: user.name }} onLeave={() => setJoined(null)} />;
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
    <StudentShell>
      <div className="mx-auto max-w-[40rem] space-y-6">
        <h1 className="text-[2rem] font-extrabold leading-10 tracking-[-0.02em]">Cours en direct</h1>

        {lives === null ? (
          failed ? (
            <section className="rounded-3xl border border-ms-line bg-ms-surface p-6" role="status">
              <p className="text-xl font-extrabold">Connexion impossible pour le moment.</p>
              <p className="mt-1 text-ms-muted">Un nouvel essai est fait toutes les quelques secondes.</p>
              <div className="mt-5"><BackToLessons /></div>
            </section>
          ) : (
            <div aria-busy="true" aria-label="Recherche des cours en direct" className="rounded-3xl border border-ms-line bg-ms-surface p-6">
              <div className="flex items-center gap-4">
                <div className="ms-skeleton h-16 w-16 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-3">
                  <div className="ms-skeleton h-6 w-3/4" />
                  <div className="ms-skeleton h-5 w-1/2" />
                </div>
              </div>
            </div>
          )
        ) : lives.length === 0 ? (
          <section aria-labelledby="attente" className="rounded-3xl border border-ms-line bg-ms-surface p-6 sm:p-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ms-slate-soft text-ms-slate-ink">
              <Radio size={32} strokeWidth={STROKE} aria-hidden="true" />
            </span>
            <h2 id="attente" className="mt-5 text-2xl font-extrabold leading-8">Le cours n&apos;a pas encore commencé.</h2>
            <p className="mt-1 text-ms-muted">Cette page se met à jour toute seule.</p>
            <div className="mt-6"><BackToLessons /></div>
          </section>
        ) : (
          <section aria-labelledby="direct" className="space-y-4">
            <h2 id="direct" className="text-2xl font-extrabold leading-8">Le cours a commencé</h2>
            <ul className="space-y-3">
              {lives.map((live) => (
                <li key={live.id} className="flex flex-col gap-4 rounded-3xl border border-ms-line bg-ms-slate-soft p-5 sm:flex-row sm:items-center sm:p-6">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ms-surface text-ms-slate-ink">
                    <Radio size={32} strokeWidth={STROKE} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p id={`cours-${live.id}`} className="text-xl font-extrabold [overflow-wrap:anywhere]">{live.name}</p>
                    {live.teacherName && <p className="text-ms-muted">avec {live.teacherName}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoin(live)}
                    aria-describedby={`cours-${live.id}`}
                    data-variant="primary"
                    className="ms-button"
                    style={{ background: "var(--ms-slate-ink)" }}
                  >
                    Rejoindre le cours
                  </button>
                </li>
              ))}
            </ul>
            <BackToLessons />
          </section>
        )}
      </div>
    </StudentShell>
  );
}
