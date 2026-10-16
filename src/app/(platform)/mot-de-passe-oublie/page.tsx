"use client";
import { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue. Réessayez.");
        return;
      }
      setSent(true);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Recevez un lien pour choisir un nouveau mot de passe">
      {sent ? (
        <div className="space-y-3 text-center">
          <CheckCircle size={40} className="mx-auto" style={{ color: "#6B705C" }} />
          <p className="font-bold text-[#2D2D2D]">Vérifiez votre boîte mail</p>
          <p className="text-sm text-[#2D2D2D]/60">
            Si un compte existe pour <span className="font-semibold break-all">{email}</span>, un email avec un lien
            de réinitialisation vient d&apos;être envoyé. Le lien est valable 1 heure.
          </p>
          <p className="text-xs text-[#2D2D2D]/40">Rien reçu ? Regardez dans les courriers indésirables, ou réessayez dans une minute.</p>
          <button type="button" onClick={() => setSent(false)} className="text-sm text-[#6B705C] hover:underline font-semibold">
            Renvoyer un lien
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Email du compte</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.be" required autoComplete="email" className={authInputClass} />
          </div>
          {error && <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-2 border border-red-100">{error}</div>}
          <button type="submit" disabled={loading} className={authButtonClass} style={{ background: "#6B705C" }}>
            {loading ? "Envoi..." : <><Mail size={16} /> Envoyer le lien</>}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
