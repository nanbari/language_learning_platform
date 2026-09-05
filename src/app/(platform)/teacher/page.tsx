"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, Users, BarChart2, Star, LogOut, CheckCircle, AlertTriangle, UserPlus, Check, X, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { fetchLessons, deleteLesson as apiDeleteLesson, type ApiLesson } from "@/lib/lessonsApi";
import { fetchTeacherInsights } from "@/lib/teacherApi";
import type { TeacherInsights, AnswerDescriptor } from "@/lib/teacherInsights";
import { fetchSignupRequests, reviewSignupRequest } from "@/lib/signupApi";
import type { SignupRequestRow } from "@/lib/signup";
import { fetchStaff, setStaffAdmin } from "@/lib/staffApi";
import type { StaffRow } from "@/lib/staff";

const LESSON_COLORS = ["#BB908E", "#8BA3B1", "#999B84", "#CCB9B5", "#7B868E", "#6B705C"];

function countExercises(lesson: { blocks: { type: string }[] }): number {
  return lesson.blocks.filter((b) => b.type === "exercise").length;
}

/** « Aujourd'hui », « Hier », « Il y a N jours ». */
function relativeDay(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function rateColor(rate: number | null): string {
  if (rate === null) return "#7B868E";
  return rate >= 0.8 ? "#6B705C" : rate >= 0.6 ? "#999B84" : "#BB908E";
}

const TYPE_LABEL: Record<string, string> = {
  quiz: "Quiz", wordorder: "Remise en ordre", matching: "Appariement", dragdrop: "Tri",
};

/** Une réponse (attendue ou erronée) : vignette si image, sinon texte. */
function AnswerChip({ answer, count, size = 28 }: { answer: AnswerDescriptor; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 pr-2 rounded-full text-xs bg-[#F5EEE8] text-[#2D2D2D]/70 overflow-hidden"
      title={answer.text ?? undefined}>
      {answer.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={answer.imageUrl} alt={answer.text ?? "réponse"} className="object-cover rounded-full"
          style={{ width: size, height: size }} />
      ) : (
        <span className="pl-2 py-0.5 max-w-[10rem] truncate">{answer.text ?? "?"}</span>
      )}
      {count !== undefined && <span className="font-bold text-[#BB908E]">×{count}</span>}
    </span>
  );
}

function TeacherPageInner() {
  const { user, logout, login } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();

  // Le store persiste l'utilisateur de la dernière connexion ; on le
  // resynchronise avec la session serveur (droit admin donné entre-temps…).
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data: { user: { id: string; email: string; name: string; role: "teacher" | "student"; isAdmin: boolean } | null }) => {
        if (data.user) login({ ...data.user, points: 0, badges: [] });
      })
      .catch(() => {});
  }, [login]);
  const [savedLessons, setSavedLessons] = useState<ApiLesson[]>([]);
  const [showToast, setShowToast] = useState(false);
  // Progression réelle des élèves, calculée côté serveur depuis exercise_events.
  const [insights, setInsights] = useState<TeacherInsights | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  // Demandes de compte élève (admins uniquement).
  const [signups, setSignups] = useState<SignupRequestRow[] | null>(null);
  const [signupBusy, setSignupBusy] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const isAdmin = user?.isAdmin === true;
  // Enseignants et leur droit admin (admins uniquement).
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [staffBusy, setStaffBusy] = useState<string | null>(null);
  const [staffMessage, setStaffMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchLessons(user.id).then(setSavedLessons).catch(() => setSavedLessons([]));
    fetchTeacherInsights()
      .then((i) => { setInsights(i); setInsightsError(null); })
      .catch((err) => setInsightsError(err instanceof Error ? err.message : "Erreur inattendue"));
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchSignupRequests().then((r) => setSignups(r.pending)).catch(() => setSignups([]));
    fetchStaff().then(setStaff).catch(() => setStaff([]));
  }, [isAdmin]);

  const toggleAdmin = async (row: StaffRow) => {
    setStaffBusy(row.id);
    setStaffMessage(null);
    try {
      const updated = await setStaffAdmin(row.id, !row.isAdmin);
      setStaff((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
      setStaffMessage(updated.isAdmin
        ? `${updated.name} est maintenant admin. Le droit s'applique à sa prochaine connexion.`
        : `${updated.name} n'est plus admin.`);
    } catch (err) {
      setStaffMessage(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setStaffBusy(null);
    }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    setSignupBusy(id);
    setSignupMessage(null);
    try {
      const done = await reviewSignupRequest(id, action);
      setSignups((prev) => (prev ?? []).filter((r) => r.id !== id));
      setSignupMessage(action === "approve"
        ? `Compte créé pour ${done.name} (${done.email}).`
        : `Demande de ${done.name} refusée.`);
    } catch (err) {
      setSignupMessage(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSignupBusy(null);
    }
  };

  useEffect(() => {
    if (params.get("published") === "1") {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
      router.replace("/teacher");
    }
  }, [params, router]);

  const deleteLesson = async (id: string) => {
    await apiDeleteLesson(id).catch(() => {});
    setSavedLessons((prev) => prev.filter((l) => l.id !== id));
  };

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    logout();
    router.push("/login");
  };

  const pending = insights === null && insightsError === null;
  const stats = [
    { label: "Leçons créées",    value: String(savedLessons.length), icon: BookOpen, color: "#BB908E" },
    { label: "Élèves actifs (30 j)", value: pending ? "…" : String(insights?.stats.activeStudents ?? 0), icon: Users, color: "#6B705C" },
    { label: "Exercices joués",  value: pending ? "…" : String(insights?.stats.exercisesPlayed ?? 0), icon: Star, color: "#999B84" },
    { label: "Réussite du 1er coup", value: pending ? "…" : percent(insights?.stats.firstTryRate ?? null), icon: BarChart2, color: "#8BA3B1" },
  ];

  return (
    <div className="min-h-screen bg-[#F5EEE8]">

      {/* Toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#2D2D2D] text-white px-5 py-3 rounded-2xl shadow-xl animate-bounce-in">
          <CheckCircle size={18} style={{ color: "#999B84" }} />
          <span className="font-bold">Leçon publiée avec succès !</span>
        </div>
      )}

      {/* Topbar */}
      <div className="bg-[#FFFDF8] border-b border-[#EDE5D8] px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/" className="flex items-end gap-2">
          <div className="relative w-8 h-8 flex items-end justify-center">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
              <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
              <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
              <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <p className="text-[10px] text-[#2D2D2D]/50 leading-none" style={{ fontFamily: "'Caveat', cursive" }}>
              ASBL
            </p>
            <span className="font-black text-[#2D2D2D] leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Monte <span className="text-[#2D2D2D]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-[#2D2D2D]/70 flex items-center gap-2">
            {user?.name || "Enseignant"}
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white" style={{ background: "#6B705C" }}>
                Admin
              </span>
            )}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-[#2D2D2D]/50 hover:text-red-400 transition-colors">
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#2D2D2D]" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Bonjour, {user?.name?.split(" ")[0]} !
          </h1>
          <p className="text-[#2D2D2D]/50">Gérez vos leçons et suivez la progression de vos élèves</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#FFFDF8] rounded-2xl p-5 shadow-sm border border-[#EDE5D8]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#2D2D2D]/50">{label}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                  <Icon size={16} style={{ color }} />
                </div>
              </div>
              <div className="text-3xl font-black" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Demandes d'inscription (admin) */}
        {isAdmin && (
          <div className="mb-10 bg-[#FFFDF8] rounded-2xl shadow-sm border border-[#EDE5D8] overflow-hidden">
            <div className="p-5 border-b border-[#EDE5D8] flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-[#2D2D2D] flex items-center gap-2">
                  <UserPlus size={18} style={{ color: "#6B705C" }} /> Demandes de compte élève
                </h2>
                <p className="text-xs text-[#2D2D2D]/50 mt-1">Le compte n&apos;est créé qu&apos;après votre approbation.</p>
              </div>
              {signups && signups.length > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-black text-white" style={{ background: "#BB908E" }}>
                  {signups.length} en attente
                </span>
              )}
            </div>
            {signupMessage && (
              <p className="px-5 py-3 text-sm border-b border-[#EDE5D8] text-[#2D2D2D]/70 bg-[#F5EEE8]/60">{signupMessage}</p>
            )}
            {signups === null && <p className="p-5 text-sm text-[#2D2D2D]/40">Chargement…</p>}
            {signups && signups.length === 0 && (
              <p className="p-5 text-sm text-[#2D2D2D]/40">Aucune demande en attente.</p>
            )}
            {signups && signups.length > 0 && (
              <ul className="divide-y divide-[#EDE5D8]">
                {signups.map((r) => (
                  <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[12rem]">
                      <p className="font-semibold text-[#2D2D2D]">{r.name}</p>
                      <p className="text-xs text-[#2D2D2D]/50">{r.email} · {relativeDay(r.created_at)}</p>
                    </div>
                    <button onClick={() => decide(r.id, "reject")} disabled={signupBusy === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 transition-colors disabled:opacity-50">
                      <X size={14} /> Refuser
                    </button>
                    <button onClick={() => decide(r.id, "approve")} disabled={signupBusy === r.id}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all disabled:opacity-50"
                      style={{ background: "#6B705C" }}>
                      <Check size={14} /> {signupBusy === r.id ? "…" : "Approuver"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Enseignants et droit admin (admin) */}
        {isAdmin && (
          <div className="mb-10 bg-[#FFFDF8] rounded-2xl shadow-sm border border-[#EDE5D8] overflow-hidden">
            <div className="p-5 border-b border-[#EDE5D8]">
              <h2 className="font-black text-[#2D2D2D] flex items-center gap-2">
                <ShieldCheck size={18} style={{ color: "#6B705C" }} /> Enseignants
              </h2>
              <p className="text-xs text-[#2D2D2D]/50 mt-1">
                Un enseignant admin approuve les demandes de compte et peut modifier toutes les leçons.
              </p>
            </div>
            {staffMessage && (
              <p className="px-5 py-3 text-sm border-b border-[#EDE5D8] text-[#2D2D2D]/70 bg-[#F5EEE8]/60">{staffMessage}</p>
            )}
            {staff === null && <p className="p-5 text-sm text-[#2D2D2D]/40">Chargement…</p>}
            {staff && staff.length === 0 && (
              <p className="p-5 text-sm text-[#2D2D2D]/40">Aucun enseignant.</p>
            )}
            {staff && staff.length > 0 && (
              <ul className="divide-y divide-[#EDE5D8]">
                {staff.map((r) => {
                  const isMe = r.id === user?.id;
                  return (
                    <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[12rem]">
                        <p className="font-semibold text-[#2D2D2D] flex items-center gap-2">
                          {r.name}
                          {isMe && <span className="text-xs font-normal text-[#2D2D2D]/40">(vous)</span>}
                          {r.isAdmin && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white" style={{ background: "#6B705C" }}>
                              Admin
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#2D2D2D]/50">{r.email}</p>
                      </div>
                      <button
                        onClick={() => toggleAdmin(r)}
                        disabled={staffBusy === r.id || (isMe && r.isAdmin)}
                        title={isMe && r.isAdmin ? "Vous ne pouvez pas retirer votre propre droit admin" : undefined}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold border-2 transition-all disabled:opacity-40 ${
                          r.isAdmin
                            ? "border-[#EDE5D8] text-[#2D2D2D]/60 hover:bg-[#F5EEE8]"
                            : "text-white hover:opacity-90"
                        }`}
                        style={r.isAdmin ? undefined : { background: "#6B705C", borderColor: "#6B705C" }}>
                        {staffBusy === r.id ? "…" : r.isAdmin ? "Retirer admin" : "Nommer admin"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Leçons */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-[#2D2D2D]">Mes leçons</h2>
          <Link href="/teacher/create"
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm text-white hover:shadow-md hover:scale-105 transition-all"
            style={{ background: "#BB908E" }}>
            <Plus size={14} /> Nouvelle leçon
          </Link>
        </div>

        {savedLessons.length === 0 && (
          <p className="text-[#2D2D2D]/40 text-sm mb-4">Aucune leçon créée pour l&apos;instant.</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {savedLessons.map((lesson, idx) => {
            const color = LESSON_COLORS[idx % LESSON_COLORS.length];
            const exCount = countExercises(lesson);
            const date = new Date(lesson.createdAt).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
            return (
              <div key={lesson.id} className="ms-card bg-[#FFFDF8] border border-[#EDE5D8] overflow-hidden">
                <div className="h-2" style={{ background: color }} />
                <div className="p-5">
                  <h3 className="font-bold text-[#2D2D2D] mb-1">{lesson.title}</h3>
                  <p className="text-xs text-[#2D2D2D]/40 mb-3">{exCount} exercice{exCount > 1 ? "s" : ""} · {date}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => deleteLesson(lesson.id)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 transition-colors">
                      Supprimer
                    </button>
                    <Link href={`/teacher/create?edit=${lesson.id}`}
                      className="flex-1 text-center py-1.5 rounded-lg text-xs font-semibold border-2 transition-all hover:opacity-80"
                      style={{ borderColor: color, color }}>
                      Modifier
                    </Link>
                    <Link href={`/student/lesson/${lesson.id}`}
                      className="flex-1 text-center py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: color }}>
                      Aperçu
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add card */}
          <Link href="/teacher/create"
            className="ms-card border-2 border-dashed border-[#CCB9B5]/50 bg-[#F5EEE8]/50 flex flex-col items-center justify-center p-8 text-center hover:border-[#BB908E] transition-colors group">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform" style={{ background: "#CCB9B5" + "30" }}>
              <Plus size={24} style={{ color: "#BB908E" }} />
            </div>
            <p className="font-bold text-[#2D2D2D]/50 text-sm">Créer une leçon</p>
          </Link>
        </div>

        {/* Exercices les moins réussis */}
        <div className="mt-10 bg-[#FFFDF8] rounded-2xl shadow-sm border border-[#EDE5D8] overflow-hidden">
          <div className="p-5 border-b border-[#EDE5D8]">
            <h2 className="font-black text-[#2D2D2D] flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: "#BB908E" }} /> Exercices les moins réussis
            </h2>
            <p className="text-xs text-[#2D2D2D]/50 mt-1">
              Pour chaque exercice : la réponse attendue, les élèves n&apos;ayant pas réussi du premier coup lors de leur dernière tentative, et les réponses erronées de chacun.
            </p>
          </div>
          {insightsError && (
            <p className="p-5 text-sm text-red-400">Impossible de charger l&apos;analyse : {insightsError}</p>
          )}
          {pending && <p className="p-5 text-sm text-[#2D2D2D]/40">Chargement…</p>}
          {insights && insights.hardest.length === 0 && (
            <p className="p-5 text-sm text-[#2D2D2D]/40">Aucune réponse erronée enregistrée pour l&apos;instant.</p>
          )}
          {insights && insights.hardest.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5EEE8]">
                  <tr>
                    {["Exercice", "Leçon", "Élèves en difficulté", "Réponses erronées", "Réponses erronées fréquentes"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#2D2D2D]/40 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE5D8]">
                  {insights.hardest.map((h) => {
                    const share = h.studentsAttempted > 0 ? h.studentsFailedFirstTry / h.studentsAttempted : 0;
                    return (
                      <tr key={`${h.lessonId}-${h.blockId}`} className="hover:bg-[#F5EEE8]/60 transition-colors align-top">
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center gap-3">
                            {h.correctAnswer?.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={h.correctAnswer.imageUrl} alt="réponse attendue"
                                className="w-12 h-12 rounded-xl object-cover border-2 flex-shrink-0" style={{ borderColor: "#6B705C" }} />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-[#2D2D2D] truncate" title={h.label}>{h.label}</p>
                              <p className="text-xs text-[#2D2D2D]/40">
                                {TYPE_LABEL[h.type] ?? h.type}
                                {h.hasAudio && " · consigne audio"}
                                {h.correctAnswer?.text && <> · réponse attendue : <span className="font-semibold text-[#6B705C]">{h.correctAnswer.text}</span></>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#2D2D2D]/60">{h.lessonTitle}</td>
                        <td className="px-4 py-3 min-w-[16rem]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-20 h-2 bg-[#EDE5D8] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: "#BB908E" }} />
                            </div>
                            <span className="font-bold text-[#2D2D2D] whitespace-nowrap">
                              {h.studentsFailedFirstTry} / {h.studentsAttempted}
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {h.students.map((st) => (
                              <li key={st.userId} className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-semibold text-[#2D2D2D]">{st.userName}</span>
                                <span className="text-[#2D2D2D]/50">
                                  · {st.wrongAttempts} erreur{st.wrongAttempts > 1 ? "s" : ""}{st.completed ? "" : ", non terminé"}
                                </span>
                                {st.wrongAnswers.map((w) => <AnswerChip key={w.key} answer={w} count={w.count} size={22} />)}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 font-bold" style={{ color: "#BB908E" }}>{h.wrongAttempts}</td>
                        <td className="px-4 py-3">
                          {h.topWrongAnswers.length === 0 ? (
                            <span className="text-xs text-[#2D2D2D]/35">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {h.topWrongAnswers.map((w) => <AnswerChip key={w.key} answer={w} count={w.count} />)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Progression des élèves */}
        <div className="mt-10 bg-[#FFFDF8] rounded-2xl shadow-sm border border-[#EDE5D8] overflow-hidden">
          <div className="p-5 border-b border-[#EDE5D8]">
            <h2 className="font-black text-[#2D2D2D]">Progression des élèves</h2>
            <p className="text-xs text-[#2D2D2D]/50 mt-1">
              Une ligne par élève et par leçon jouée. La réussite compte les exercices réussis du premier coup.
            </p>
          </div>
          {pending && <p className="p-5 text-sm text-[#2D2D2D]/40">Chargement…</p>}
          {insights && insights.rows.length === 0 && (
            <p className="p-5 text-sm text-[#2D2D2D]/40">Aucun élève n&apos;a encore joué vos leçons.</p>
          )}
          {insights && insights.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5EEE8]">
                  <tr>
                    {["Élève", "Leçon", "Réussite 1er coup", "Progression", "À revoir", "Dernière activité"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#2D2D2D]/40 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE5D8]">
                  {insights.rows.map((row) => {
                    const progress = row.exercisesTotal > 0 ? row.exercisesSeen / row.exercisesTotal : 0;
                    return (
                      <tr key={`${row.userId}-${row.lessonId}`} className="hover:bg-[#F5EEE8]/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#2D2D2D]">{row.userName}</td>
                        <td className="px-4 py-3 text-[#2D2D2D]/60">{row.lessonTitle}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold" style={{ color: rateColor(row.firstTryRate) }}>{percent(row.firstTryRate)}</span>
                          <span className="text-xs text-[#2D2D2D]/35 ml-1">({row.firstTrySuccesses}/{row.exercisesAttempted})</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-[#EDE5D8] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: "#8BA3B1" }} />
                            </div>
                            <span className="text-xs text-[#2D2D2D]/50 whitespace-nowrap">{row.exercisesSeen}/{row.exercisesTotal}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.toReview > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "#BB908E" }}>
                              {row.toReview}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold" style={{ color: "#6B705C" }}>✓</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#2D2D2D]/35 text-xs whitespace-nowrap">{relativeDay(row.lastActivityAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5EEE8]"><div className="text-4xl animate-float">🌟</div></div>}>
      <TeacherPageInner />
    </Suspense>
  );
}
