"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LogIn, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { SessionUser } from "@/server/auth";
import { AuthError, AuthField, AuthShell, PasswordInput } from "@/components/layout/AuthShell";

const ICON_STROKE = 1.75;
const TITLE = "Connexion";
const SUBTITLE = "Accédez à votre espace d'apprentissage";

/** Espace d'une personne connectée. */
function dashboardFor(u: Pick<SessionUser, "role" | "isAdmin">): string {
  return u.role === "teacher" || u.isAdmin ? "/teacher" : "/student";
}

const SIGNUP_FOOTER = (
  <>
    Pas encore de compte élève ?{" "}
    <Link href="/inscription" className="inline-flex min-h-11 items-center font-semibold text-ms-primary underline-offset-4 hover:underline">Faire une demande</Link>
  </>
);

function LoginForm() {
  const params = useSearchParams();
  const defaultRole = (params.get("role") as "student" | "teacher") || "student";
  const [role, setRole] = useState<"student" | "teacher">(defaultRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Session déjà ouverte dans ce navigateur (undefined = pas encore vérifié)
  const [current, setCurrent] = useState<SessionUser | null | undefined>(undefined);
  const errorRef = useRef<HTMLDivElement>(null);
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

  // Après un envoi raté, le focus va sur le message (les champs gardent leur saisie).
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
      login(data.user);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : dashboardFor(data.user));
    } catch {
      setError("Erreur réseau. Réessayez.");
      setLoading(false);
    }
  };

  if (current) {
    return (
      <AuthShell title={TITLE} subtitle={SUBTITLE} footer={SIGNUP_FOOTER}>
        <div className="flex flex-col gap-5">
          <div className="min-w-0">
            <p className="text-sm text-ms-muted">Vous êtes déjà connecté·e en tant que</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-lg font-semibold [overflow-wrap:anywhere]">{current.name}</span>
              <span className="ms-status" data-state="info">{current.role === "teacher" ? "Enseignant" : "Élève"}</span>
            </p>
            <p className="mt-1 text-sm text-ms-muted [overflow-wrap:anywhere]">{current.email}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                const next = params.get("next");
                router.push(next && next.startsWith("/") ? next : dashboardFor(current));
              }}
              data-variant="primary"
              className="ms-button w-full"
            >
              Continuer <ArrowRight size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
            <button type="button" onClick={handleSwitchAccount} data-variant="secondary" className="ms-button w-full">
              <LogOut size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Se déconnecter et changer de compte
            </button>
          </div>
          <p className="text-center text-[0.8125rem] leading-[1.125rem] text-ms-muted">
            Ordinateur partagé ? Pensez à vous déconnecter après usage.
          </p>
        </div>
      </AuthShell>
    );
  }

  const describedBy = error ? "login-error" : undefined;

  return (
    <AuthShell title={TITLE} subtitle={SUBTITLE} footer={SIGNUP_FOOTER}>
      {/* Choix de l'espace */}
      <div role="group" aria-label="Je me connecte en tant que" className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-ms-surface-muted p-1">
        {(["student", "teacher"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className={`min-h-11 rounded-lg px-3 text-[0.9375rem] font-semibold transition-colors duration-[140ms] ${
              role === r ? "bg-ms-surface text-ms-primary shadow-[var(--ms-shadow-control)]" : "text-ms-muted hover:text-ms-ink"
            }`}
          >
            {r === "student" ? "Élève" : "Enseignant"}
          </button>
        ))}
      </div>

      {params.get("reset") === "ok" && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-xl bg-ms-primary-soft px-4 py-3 text-sm leading-5 text-ms-primary">
          <CheckCircle2 size={18} strokeWidth={ICON_STROKE} className="mt-px shrink-0" aria-hidden="true" />
          Mot de passe enregistré. Vous pouvez vous connecter.
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <AuthField id="login-email" label="Adresse e-mail">
          <input
            id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.be" required autoComplete="email"
            aria-describedby={describedBy} aria-invalid={error ? true : undefined}
            className="ms-field"
          />
        </AuthField>
        <AuthField
          id="login-password"
          label="Mot de passe"
          action={
            <Link href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center text-sm font-semibold text-ms-primary underline-offset-4 hover:underline">
              Mot de passe oublié ?
            </Link>
          }
        >
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password"
            describedBy={describedBy} invalid={!!error} />
        </AuthField>

        <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-sm leading-5">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--ms-primary)]"
          />
          Rester connecté·e sur cet appareil (7 jours)
        </label>

        <AuthError id="login-error" message={error} ref={errorRef} />

        <button type="submit" disabled={loading || current === undefined} data-variant="primary" className="ms-button w-full">
          {loading ? "Connexion…" : <><LogIn size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Se connecter</>}
        </button>
      </form>
    </AuthShell>
  );
}

/** Pendant la lecture des paramètres : la forme du formulaire, sans animation. */
function LoginSkeleton() {
  return (
    <AuthShell title={TITLE} subtitle={SUBTITLE} footer={null}>
      <div aria-busy="true" aria-label="Chargement du formulaire" className="flex flex-col gap-5">
        <div className="ms-skeleton h-[3.25rem] w-full" />
        <div className="ms-skeleton h-4 w-32" />
        <div className="ms-skeleton h-12 w-full" />
        <div className="ms-skeleton h-4 w-28" />
        <div className="ms-skeleton h-12 w-full" />
        <div className="ms-skeleton h-12 w-full" />
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
