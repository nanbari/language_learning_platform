"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, LogOut, CheckCircle, UserPlus, Users, Check, X, ShieldCheck, Presentation, Mic, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { fetchLessons, deleteLesson as apiDeleteLesson, type ApiLesson } from "@/lib/lessonsApi";
import { fetchTeacherInsights } from "@/lib/teacherApi";
import type { TeacherInsights, AnswerDescriptor, ExerciseStatus, StudentProgress } from "@/lib/teacherInsights";
import { fetchSignupRequests, reviewSignupRequest } from "@/lib/signupApi";
import type { SignupRequestRow } from "@/lib/signup";
import { createTeacher, fetchStaff, setStaffAdmin, type CreatedTeacher } from "@/lib/staffApi";
import { MIN_NAME } from "@/lib/signup";
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

const STATUS: Record<ExerciseStatus, { label: string; color: string; solid: boolean }> = {
  first_try:    { label: "Réussi du 1er coup",   color: "#6B705C", solid: true },
  after_errors: { label: "Réussi après erreurs", color: "#999B84", solid: true },
  failed:       { label: "À revoir",             color: "#BB908E", solid: true },
  seen:         { label: "Vu, sans réponse",     color: "#8BA3B1", solid: false },
  not_started:  { label: "Pas commencé",         color: "#7B868E", solid: false },
};

function StatusBadge({ status }: { status: ExerciseStatus }) {
  const { label, color, solid } = STATUS[status];
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
      style={solid ? { background: color, color: "#fff" } : { color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  );
}

function ProgressBar({ done, total, color = "#8BA3B1" }: { done: number; total: number; color?: string }) {
  const share = total > 0 ? done / total : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-[#EDE5D8] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: color }} />
      </div>
      <span className="text-xs text-[#2D2D2D]/50 whitespace-nowrap">{done}/{total}</span>
    </div>
  );
}

/** Formulaire admin : crée un compte enseignant ; l'invitation part par e-mail (ou lien de secours). */
function NewTeacherForm({ onCreated }: { onCreated: (created: CreatedTeacher) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await createTeacher({ name, email, isAdmin: admin }));
      setName(""); setEmail(""); setAdmin(false); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full px-3 py-2 rounded-lg border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#6B705C] outline-none text-sm text-[#2D2D2D]";

  if (!open) {
    return (
      <div className="px-5 py-3 border-b border-[#EDE5D8]">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all"
          style={{ background: "#6B705C" }}>
          <UserPlus size={14} /> Créer un compte enseignant
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="px-5 py-4 border-b border-[#EDE5D8] bg-[#F5EEE8]/40 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required minLength={MIN_NAME} />
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
      </div>
      <p className="text-xs text-[#2D2D2D]/50">
        Un e-mail d&apos;invitation lui sera envoyé : c&apos;est l&apos;enseignant qui choisira son mot de passe en ouvrant le lien.
      </p>
      <label className="flex items-center gap-2 text-sm text-[#2D2D2D]/70 select-none cursor-pointer">
        <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="w-4 h-4 accent-[#6B705C]" />
        Lui donner aussi le droit admin
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy}
          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all disabled:opacity-50"
          style={{ background: "#6B705C" }}>
          {busy ? "Création…" : "Créer le compte"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold border-2 border-[#EDE5D8] text-[#2D2D2D]/60 hover:bg-[#F5EEE8]">
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Lien d'invitation d'un enseignant tout juste créé, à copier et lui transmettre. */
function InviteLinkBox({ name, email, link, onClose }: { name: string; email: string; link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* sélection manuelle possible */ }
  };
  return (
    <div className="px-5 py-4 border-b border-[#EDE5D8] bg-[#6B705C]/10 space-y-2">
      <p className="text-sm text-[#2D2D2D]">
        Compte enseignant créé pour <span className="font-bold">{name}</span>, mais l&apos;e-mail d&apos;invitation n&apos;a
        pas pu être envoyé. Transmettez-lui vous-même ce lien ({email}) : il y choisira son mot de passe, puis pourra se connecter.
      </p>
      <div className="flex gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#EDE5D8] bg-[#FFFDF8] text-xs text-[#2D2D2D]/70" />
        <button onClick={copy} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90" style={{ background: "#6B705C" }}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p className="text-xs text-[#2D2D2D]/50">
        Le lien ne sert qu&apos;une fois et expire (1 h par défaut dans Supabase). Passé ce délai, l&apos;enseignant peut
        utiliser « Mot de passe oublié » sur la page de connexion.{" "}
        <button onClick={onClose} className="underline">Fermer</button>
      </p>
    </div>
  );
}

/** Tableau d'un élève : une ligne de titre par leçon, puis une ligne par exercice. */
function StudentProgressTable({ student, defaultOpen }: { student: StudentProgress; defaultOpen: boolean }) {
  const seen = student.lessons.reduce((n, l) => n + l.exercisesSeen, 0);
  const total = student.lessons.reduce((n, l) => n + l.exercisesTotal, 0);
  return (
    <details open={defaultOpen} className="group">
      <summary className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 cursor-pointer list-none hover:bg-[#F5EEE8]/60 transition-colors">
        <ChevronDown size={16} className="text-[#2D2D2D]/40 transition-transform -rotate-90 group-open:rotate-0" />
        <span className="font-black text-[#2D2D2D] min-w-[8rem]">{student.userName}</span>
        <span className="text-xs text-[#2D2D2D]/50">
          {student.lessons.length} leçon{student.lessons.length > 1 ? "s" : ""}
        </span>
        <ProgressBar done={seen} total={total} />
        <span className="text-xs text-[#2D2D2D]/50">
          1er coup : <span className="font-bold" style={{ color: rateColor(student.firstTryRate) }}>{percent(student.firstTryRate)}</span>
        </span>
        {student.toReview > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "#BB908E" }}>
            {student.toReview} à revoir
          </span>
        ) : (
          <span className="text-xs font-semibold" style={{ color: "#6B705C" }}>✓ rien à revoir</span>
        )}
        <span className="text-xs text-[#2D2D2D]/50">
          {student.wrongAttempts} erreur{student.wrongAttempts > 1 ? "s" : ""}
          {student.earlierWrongAttempts > 0 && (
            <span className="text-[#2D2D2D]/35" title="Erreurs lors de tentatives précédentes"> (+{student.earlierWrongAttempts} avant)</span>
          )}
        </span>
        <span className="text-xs text-[#2D2D2D]/35 ml-auto">{relativeDay(student.lastActivityAt)}</span>
      </summary>

      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full text-sm border border-[#EDE5D8] rounded-xl overflow-hidden">
          <thead className="bg-[#F5EEE8]">
            <tr>
              {["Exercice", "Statut", "Erreurs", "Réponses erronées", "Dernière activité"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-[#2D2D2D]/40 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          {student.lessons.map((lesson) => (
            <tbody key={lesson.lessonId} className="divide-y divide-[#EDE5D8] border-t-2 border-[#EDE5D8]">
              <tr className="bg-[#FFFDF8]">
                <td colSpan={5} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-bold text-[#2D2D2D]">{lesson.lessonTitle}</span>
                    <ProgressBar done={lesson.exercisesSeen} total={lesson.exercisesTotal} />
                    <span className="text-xs text-[#2D2D2D]/50">
                      1er coup : <span className="font-bold" style={{ color: rateColor(lesson.firstTryRate) }}>{percent(lesson.firstTryRate)}</span>
                      <span className="text-[#2D2D2D]/35"> ({lesson.firstTrySuccesses}/{lesson.exercisesAttempted})</span>
                    </span>
                    {lesson.toReview > 0 && (
                      <span className="text-xs font-bold" style={{ color: "#BB908E" }}>{lesson.toReview} à revoir</span>
                    )}
                    <span className="text-xs text-[#2D2D2D]/35 ml-auto">{relativeDay(lesson.lastActivityAt)}</span>
                  </div>
                </td>
              </tr>
              {lesson.exercises.map((ex) => (
                <tr key={ex.blockId} className={`align-top ${ex.status === "not_started" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 max-w-xs">
                    <div className="flex items-center gap-3">
                      {ex.correctAnswer?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ex.correctAnswer.imageUrl} alt="réponse attendue"
                          className="w-10 h-10 rounded-lg object-cover border-2 flex-shrink-0" style={{ borderColor: "#6B705C" }} />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-[#2D2D2D] truncate" title={ex.label}>{ex.position}. {ex.label}</p>
                        <p className="text-xs text-[#2D2D2D]/40">
                          {TYPE_LABEL[ex.type] ?? ex.type}
                          {ex.hasAudio && " · consigne audio"}
                          {ex.correctAnswer?.text && <> · attendu : <span className="font-semibold text-[#6B705C]">{ex.correctAnswer.text}</span></>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={ex.status} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-bold" style={{ color: ex.wrongAttempts > 0 ? "#BB908E" : "#2D2D2D59" }}>{ex.wrongAttempts}</span>
                    {ex.earlierWrongAttempts > 0 && (
                      <span className="text-xs text-[#2D2D2D]/35 ml-1" title="Erreurs lors de tentatives précédentes">+{ex.earlierWrongAttempts} avant</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {ex.wrongAnswers.length === 0 && ex.earlierWrongAnswers.length === 0 ? (
                      <span className="text-xs text-[#2D2D2D]/35">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ex.wrongAnswers.map((w) => <AnswerChip key={w.key} answer={w} count={w.count} size={22} />)}
                        {ex.earlierWrongAnswers.length > 0 && (
                          <span className="inline-flex flex-wrap items-center gap-1.5 opacity-50" title="Réponses erronées lors de tentatives précédentes">
                            <span className="text-xs text-[#2D2D2D]/60">avant :</span>
                            {ex.earlierWrongAnswers.map((w) => <AnswerChip key={w.key} answer={w} count={w.count} size={22} />)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#2D2D2D]/35 whitespace-nowrap">
                    {ex.lastActivityAt ? relativeDay(ex.lastActivityAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </details>
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
        if (data.user) login({ ...data.user, badges: [] });
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
  // Lien d'invitation du dernier enseignant créé, à transmettre.
  const [invite, setInvite] = useState<{ name: string; email: string; link: string } | null>(null);

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
              Monte <span className="text-[#8BA3B1]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
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
            <NewTeacherForm onCreated={(created) => {
              const row = created.user;
              setStaff((prev) => [...(prev ?? []), row].sort((a, b) => a.name.localeCompare(b.name)));
              if (created.emailSent) {
                setInvite(null);
                setStaffMessage(`Compte enseignant créé pour ${row.name}. Une invitation a été envoyée à ${row.email} : il y choisira son mot de passe.`);
              } else {
                setStaffMessage(null);
                setInvite({ name: row.name, email: row.email, link: created.inviteLink });
              }
            }} />
            {invite && <InviteLinkBox {...invite} onClose={() => setInvite(null)} />}
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/teacher/letters"
                className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border-2 border-[#6B705C] text-[#6B705C] hover:bg-[#6B705C]/10 transition-all">
                <Mic size={14} /> Sons des lettres
              </Link>
            )}
            <Link href="/teacher/classes"
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border-2 border-[#6B705C] text-[#6B705C] hover:bg-[#6B705C]/10 transition-all">
              <Users size={14} /> Mes classes
            </Link>
            <Link href="/teacher/present"
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm text-white hover:shadow-md hover:scale-105 transition-all"
              style={{ background: "#6B705C" }}>
              <Presentation size={14} /> Cours en direct
            </Link>
            <Link href="/teacher/create"
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm text-white hover:shadow-md hover:scale-105 transition-all"
              style={{ background: "#BB908E" }}>
              <Plus size={14} /> Nouvelle leçon
            </Link>
          </div>
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

        {/* Progression par élève */}
        <div className="mt-10 bg-[#FFFDF8] rounded-2xl shadow-sm border border-[#EDE5D8] overflow-hidden">
          <div className="p-5 border-b border-[#EDE5D8]">
            <h2 className="font-black text-[#2D2D2D] flex items-center gap-2">
              <Users size={18} style={{ color: "#6B705C" }} /> Progression par élève
            </h2>
            <p className="text-xs text-[#2D2D2D]/50 mt-1">
              Un tableau par élève : chaque leçon jouée, puis chaque exercice avec son statut, ses erreurs et ses réponses erronées lors de la dernière tentative. Les erreurs des tentatives précédentes sont indiquées à part, en gris («&nbsp;+2 avant&nbsp;»).
            </p>
          </div>
          {insightsError && (
            <p className="p-5 text-sm text-red-400">Impossible de charger la progression : {insightsError}</p>
          )}
          {pending && <p className="p-5 text-sm text-[#2D2D2D]/40">Chargement…</p>}
          {insights && insights.students.length === 0 && (
            <p className="p-5 text-sm text-[#2D2D2D]/40">Aucun élève n&apos;a encore joué vos leçons.</p>
          )}
          {insights && insights.students.length > 0 && (
            <div className="divide-y divide-[#EDE5D8]">
              {insights.students.map((st, idx) => <StudentProgressTable key={st.userId} student={st} defaultOpen={idx === 0} />)}
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
