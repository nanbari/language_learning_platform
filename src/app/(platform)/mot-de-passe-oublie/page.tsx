"use client";
import { useEffect, useRef, useState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { AuthError, AuthField, AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  // Après un envoi raté, le focus va sur le message (l'adresse saisie reste).
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ms-primary-soft text-ms-ink">
            <MailCheck size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold leading-7">Vérifiez votre boîte mail</h2>
          <p className="text-ms-muted">
            Si un compte existe pour <span className="font-semibold text-ms-ink [overflow-wrap:anywhere]">{email}</span>, un email avec un lien
            de réinitialisation vient d&apos;être envoyé. Le lien est valable 1 heure.
          </p>
          <p className="text-sm leading-5 text-ms-muted">Rien reçu ? Regardez dans les courriers indésirables, ou réessayez dans une minute.</p>
          <button type="button" onClick={() => setSent(false)} data-variant="quiet" className="ms-button">
            Renvoyer un lien
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AuthField id="email" label="Adresse e-mail du compte">
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.be" required autoComplete="email"
              aria-describedby={error ? "forgot-error" : undefined} aria-invalid={error ? true : undefined}
              className={authInputClass} />
          </AuthField>
          <AuthError id="forgot-error" message={error} ref={errorRef} />
          <button type="submit" disabled={loading} data-variant="primary" className={authButtonClass}>
            {loading ? "Envoi…" : <><Mail size={18} strokeWidth={1.75} aria-hidden="true" /> Envoyer le lien</>}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
