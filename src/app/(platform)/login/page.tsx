"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, LogOut, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { SessionUser } from "@/lib/auth";

/** Espace d'une personne connectée. */
function dashboardFor(u: Pick<SessionUser, "role" | "isAdmin">): string {
  return u.role === "teacher" || u.isAdmin ? "/teacher" : "/student";
}

function LoginForm() {
  const params = useSearchParams();
  const defaultRole = (params.get("role") as "student" | "teacher") || "student";
  const [role, setRole] = useState<"student" | "teacher">(defaultRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Session déjà ouverte dans ce navigateur (undefined = pas encore vérifié)
  const [current, setCurrent] = useState<SessionUser | null | undefined>(undefined);
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const clearStore = useAuthStore((s) => s.logout);

  // Vérifie côté serveur si une session est encore valide dans ce navigateur.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user: SessionUser | null }) => { if (!cancelled) setCurrent(d.user ?? null); })
      .catch(() => { if (!cancelled) setCurrent(null); });
    return () => { cancelled = true; };
  }, []);

  const handleSwitchAccount = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    clearStore();
    setCurrent(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setError(data.error || "Identifiants incorrects.");
        setLoading(false);
        return;
      }
      // Mirror server-validated user into Zustand for UI use
      login({ ...data.user, points: 0, badges: [] });
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : dashboardFor(data.user));
    } catch {
      setError("Erreur réseau. Réessayez.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EEE8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-end gap-3 group mb-6">
              {/* Logo */}
            <div className="relative w-10 h-10 flex items-end justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="group-hover:scale-110 transition-transform">
                {/* plus basse à gauche */}
                <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
                {/* moyenne au centre */}
                <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
                {/* plus haute à droite */}
                <rect x="28" y="10"  width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
                <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <p className="text-xs text-left text-[#2D2D2D]/50 leading-none" style={{ fontFamily: "'Caveat', cursive" }}>
                ASBL
              </p>
              <span className="font-black text-xl text-[#2D2D2D] leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Monte <span className="text-[#2D2D2D]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
              </span>
            </div>
          </Link>
          <h1 className="text-2xl font-black text-[#2D2D2D]">Connexion</h1>
          <p className="text-[#2D2D2D]/50 text-sm mt-1">Accédez à votre espace d'apprentissage</p>
        </div>

        {current ? (
          <div className="bg-[#FFFDF8] rounded-3xl shadow-lg p-8 border border-[#EDE5D8] space-y-4">
            <p className="text-sm text-[#2D2D2D]/60">Vous êtes déjà connecté·e en tant que</p>
            <p className="font-black text-lg text-[#2D2D2D]">
              {current.name}
              <span className="ml-2 text-xs font-semibold text-[#6B705C] bg-[#EDE5D8] rounded-full px-2 py-0.5 align-middle">
                {current.role === "teacher" ? "Enseignant" : "Élève"}
              </span>
            </p>
            <p className="text-xs text-[#2D2D2D]/40 break-all">{current.email}</p>
            <button
              type="button"
              onClick={() => {
                const next = params.get("next");
                router.push(next && next.startsWith("/") ? next : dashboardFor(current));
              }}
              className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.02] transition-all"
              style={{ background: "#6B705C" }}
            >
              Continuer <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-[#EDE5D8] text-[#2D2D2D]/70 hover:bg-[#F5EEE8] transition-all"
            >
              <LogOut size={16} /> Se déconnecter et changer de compte
            </button>
            <p className="text-xs text-center text-[#2D2D2D]/40">
              Ordinateur partagé ? Pensez à vous déconnecter après usage.
            </p>
          </div>
        ) : (
        <div className="bg-[#FFFDF8] rounded-3xl shadow-lg p-8 border border-[#EDE5D8]">
          {/* Role selector */}
          <div className="flex rounded-2xl bg-[#EDE5D8] p-1 mb-6">
            {(["student", "teacher"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  role === r
                    ? "bg-[#FFFDF8] shadow text-[#6B705C]"
                    : "text-[#2D2D2D]/50"
                }`}
              >
                {r === "student" ? "Élève" : "Enseignant"}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.be"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#6B705C] focus:ring-2 focus:ring-[#6B705C]/20 outline-none transition-all text-[#2D2D2D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#6B705C] focus:ring-2 focus:ring-[#6B705C]/20 outline-none transition-all text-[#2D2D2D]"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2D2D2D]/40">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-[#2D2D2D]/70 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#EDE5D8] accent-[#6B705C]"
              />
              Rester connecté·e sur cet appareil (7 jours)
            </label>

            {error && <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-2 border border-red-100">{error}</div>}

            <button
              type="submit"
              disabled={loading || current === undefined}
              className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-70"
              style={{ background: "#6B705C" }}
            >
              {loading ? "Connexion..." : <><LogIn size={16} /> Se connecter</>}
            </button>
          </form>

        </div>
        )}

        <p className="text-center text-sm text-[#2D2D2D]/50 mt-6">
          Pas encore de compte élève ?{" "}
          <Link href="/inscription" className="text-[#6B705C] hover:underline font-semibold">Faire une demande</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5EEE8]"><div className="text-2xl animate-float">🌟</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
