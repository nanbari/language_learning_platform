"use client";
/**
 * Demande de compte élève (page publique).
 *
 * Le formulaire n'ouvre pas de compte : il enregistre une demande qu'un
 * administrateur approuve depuis son tableau de bord. Voir src/lib/signup.ts.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus, Clock } from "lucide-react";
import { submitSignup } from "@/lib/signupApi";
import { MIN_PASSWORD } from "@/lib/signup";
import { useAuthStore } from "@/store/authStore";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  // Si une session est ouverte dans ce navigateur (un enseignant qui teste,
  // un frère ou une sœur déjà connecté), on la ferme d'abord : sinon la
  // page de connexion renverrait vers le tableau de bord de cette session.
  const goToLogin = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    logout();
    router.push("/login?role=student");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await submitSignup({ name, email, password });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#6B705C] focus:ring-2 focus:ring-[#6B705C]/20 outline-none transition-all text-[#2D2D2D]";

  return (
    <div className="min-h-screen bg-[#F5EEE8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-end gap-3 group mb-6">
            <div className="relative w-10 h-10 flex items-end justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="group-hover:scale-110 transition-transform">
                <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
                <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
                <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
                <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <p className="text-xs text-left text-[#2D2D2D]/50 leading-none" style={{ fontFamily: "'Caveat', cursive" }}>ASBL</p>
              <span className="font-black text-xl text-[#2D2D2D] leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Monte <span className="text-[#2D2D2D]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
              </span>
            </div>
          </Link>
          <h1 className="text-2xl font-black text-[#2D2D2D]">Demander un compte élève</h1>
          <p className="text-[#2D2D2D]/50 text-sm mt-1">Un administrateur valide chaque demande avant l&apos;ouverture du compte.</p>
        </div>

        <div className="bg-[#FFFDF8] rounded-3xl shadow-lg p-8 border border-[#EDE5D8]">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#999B8420" }}>
                <Clock size={26} style={{ color: "#6B705C" }} />
              </div>
              <h2 className="text-xl font-black text-[#2D2D2D] mb-2">Demande envoyée !</h2>
              <p className="text-[#2D2D2D]/60 text-sm mb-6">
                Un administrateur va vérifier la demande de <strong>{name.trim()}</strong>. Une fois approuvée, tu pourras te connecter avec l&apos;adresse <strong>{email.trim().toLowerCase()}</strong> et le mot de passe choisi.
              </p>
              <button onClick={goToLogin}
                className="inline-block px-6 py-3 rounded-xl text-white font-bold hover:shadow-md transition-all"
                style={{ background: "#6B705C" }}>
                Aller à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Prénom et nom</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Léa Martin" required minLength={2} maxLength={80} autoComplete="name" className={input} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.be" required autoComplete="email" className={input} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Mot de passe</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={MIN_PASSWORD} autoComplete="new-password" className={`${input} pr-12`} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2D2D2D]/40">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-[#2D2D2D]/40 mt-1">Au moins {MIN_PASSWORD} caractères.</p>
              </div>

              {error && <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-2 border border-red-100">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-70"
                style={{ background: "#6B705C" }}>
                {loading ? "Envoi…" : <><UserPlus size={16} /> Envoyer la demande</>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[#2D2D2D]/40 mt-6">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-[#6B705C] hover:underline font-semibold">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
