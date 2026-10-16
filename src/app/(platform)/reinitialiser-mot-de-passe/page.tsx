"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";
import { MIN_PASSWORD } from "@/lib/signup";
import { readRecoveryHash } from "@/lib/passwordReset";

export default function ResetPasswordPage() {
  const router = useRouter();
  // undefined = fragment pas encore lu (il n'existe que côté navigateur)
  const [link, setLink] = useState<ReturnType<typeof readRecoveryHash> | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const read = readRecoveryHash(window.location.hash);
    // Le jeton ne doit pas rester dans la barre d'adresse ni dans l'historique.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du fragment au montage
    setLink(read);
  }, []);

  // Lien d'invitation (compte enseignant créé par un admin) : premier mot de passe.
  const invite = link?.kind === "token" && link.invite;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (link?.kind !== "token") return;
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", accessToken: link.accessToken, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue. Réessayez.");
        setLoading(false);
        return;
      }
      router.push("/login?reset=ok");
    } catch {
      setError("Erreur réseau. Réessayez.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={invite ? "Bienvenue !" : "Nouveau mot de passe"}
      subtitle={invite ? "Choisissez le mot de passe de votre compte enseignant" : "Choisissez le mot de passe de votre compte"}
    >
      {link === undefined && <p className="text-sm text-center text-[#2D2D2D]/40">Chargement…</p>}

      {link && link.kind !== "token" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[#2D2D2D]/70">
            {link.kind === "error"
              ? link.message
              : "Ouvrez cette page depuis le lien reçu par email."}
          </p>
          <Link href="/mot-de-passe-oublie" className={authButtonClass} style={{ background: "#6B705C" }}>
            Demander un nouveau lien
          </Link>
        </div>
      )}

      {link?.kind === "token" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input id="password" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={MIN_PASSWORD} autoComplete="new-password" className={`${authInputClass} pr-12`} />
              <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Masquer" : "Afficher"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2D2D2D]/40">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-[#2D2D2D]/40 mt-1">Au moins {MIN_PASSWORD} caractères.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Confirmer le mot de passe</label>
            <input id="confirm" type={showPass ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••" required minLength={MIN_PASSWORD} autoComplete="new-password" className={authInputClass} />
          </div>
          {error && <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-2 border border-red-100">{error}</div>}
          <button type="submit" disabled={loading} className={authButtonClass} style={{ background: "#6B705C" }}>
            {loading ? "Enregistrement..." : <><KeyRound size={16} /> Enregistrer le mot de passe</>}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
