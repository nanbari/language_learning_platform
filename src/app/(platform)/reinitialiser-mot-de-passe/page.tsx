"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Link2Off } from "lucide-react";
import { AuthError, AuthField, AuthShell, PasswordInput, authButtonClass } from "@/components/layout/AuthShell";
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
  // Les deux saisies diffèrent : seule la confirmation est signalée.
  const [mismatch, setMismatch] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = readRecoveryHash(window.location.hash);
    // Le jeton ne doit pas rester dans la barre d'adresse ni dans l'historique.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du fragment au montage
    setLink(read);
  }, []);

  // Après un envoi raté, le focus va sur le message (les saisies restent).
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Lien d'invitation (compte enseignant créé par un admin) : premier mot de passe.
  const invite = link?.kind === "token" && link.invite;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (link?.kind !== "token") return;
    if (password !== confirm) {
      setMismatch(true);
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setMismatch(false);
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
      title={invite ? "Bienvenue" : "Nouveau mot de passe"}
      subtitle={invite ? "Choisissez le mot de passe de votre compte enseignant" : "Choisissez le mot de passe de votre compte"}
    >
      {link === undefined && (
        <div aria-busy="true" aria-label="Lecture du lien" className="flex flex-col gap-5">
          <div className="ms-skeleton h-4 w-40" />
          <div className="ms-skeleton h-12 w-full" />
          <div className="ms-skeleton h-4 w-48" />
          <div className="ms-skeleton h-12 w-full" />
          <div className="ms-skeleton h-12 w-full" />
        </div>
      )}

      {link && link.kind !== "token" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ms-review-soft text-ms-review">
            <Link2Off size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="text-ms-muted">
            {link.kind === "error"
              ? link.message
              : "Ouvrez cette page depuis le lien reçu par email."}
          </p>
          <Link href="/mot-de-passe-oublie" data-variant="primary" className={authButtonClass}>
            Demander un nouveau lien
          </Link>
        </div>
      )}

      {link?.kind === "token" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AuthField id="password" label="Nouveau mot de passe" hint={`Au moins ${MIN_PASSWORD} caractères.`}>
            <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password"
              minLength={MIN_PASSWORD} show={showPass} onToggle={() => setShowPass((s) => !s)}
              describedBy={`password-hint${error && !mismatch ? " reset-error" : ""}`} invalid={!!error && !mismatch} />
          </AuthField>
          <AuthField id="confirm" label="Confirmer le mot de passe">
            <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password"
              minLength={MIN_PASSWORD} show={showPass} onToggle={() => setShowPass((s) => !s)}
              describedBy={error ? "reset-error" : undefined} invalid={mismatch} />
          </AuthField>
          <AuthError id="reset-error" message={error} ref={errorRef} />
          <button type="submit" disabled={loading} data-variant="primary" className={authButtonClass}>
            {loading ? "Enregistrement…" : <><KeyRound size={18} strokeWidth={1.75} aria-hidden="true" /> Enregistrer le mot de passe</>}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
