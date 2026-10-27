"use client";
import { useEffect, useId, useState } from "react";
import { UserPlus } from "lucide-react";
import TeacherShell from "@/components/teacher/TeacherShell";
import { useTeacherSession } from "@/components/teacher/useTeacherSession";
import { Button, EmptyState, ICON_STROKE, InlineNotice, SectionHeader, SkeletonRows, StatusPill } from "@/components/platform/ui";
import { createTeacher, fetchStaff, setStaffAdmin, type CreatedTeacher } from "@/lib/api/staff";
import { MIN_NAME } from "@/lib/signup";
import type { StaffRow } from "@/lib/staff";

/** Formulaire admin : crée un compte enseignant ; l'invitation part par e-mail (ou lien de secours). */
function NewTeacherForm({ onCreated }: { onCreated: (created: CreatedTeacher) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

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

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Créer un compte enseignant
      </Button>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${ids}-t`} className="ms-panel w-full space-y-4 p-4 sm:p-5">
      <h3 id={`${ids}-t`} className="font-semibold">Nouveau compte enseignant</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${ids}-n`} className="text-sm font-semibold">Nom complet</label>
          <input id={`${ids}-n`} className="ms-field" value={name} onChange={(e) => setName(e.target.value)} required minLength={MIN_NAME} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${ids}-e`} className="text-sm font-semibold">E-mail</label>
          <input id={`${ids}-e`} className="ms-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" aria-describedby={`${ids}-h`} />
        </div>
      </div>
      <p id={`${ids}-h`} className="text-sm text-ms-muted">
        Un e-mail d&apos;invitation lui sera envoyé : c&apos;est l&apos;enseignant qui choisira son mot de passe en ouvrant le lien.
      </p>
      <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-sm">
        <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="h-5 w-5 accent-[var(--ms-primary)]" />
        Lui donner aussi le droit admin
      </label>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Création…" : "Créer le compte"}</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setError(null); }}>Annuler</Button>
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
    <InlineNotice>
      <p>
        Compte enseignant créé pour <span className="font-semibold">{name}</span>, mais l&apos;e-mail d&apos;invitation n&apos;a
        pas pu être envoyé. Transmettez-lui vous-même ce lien ({email}) : il y choisira son mot de passe, puis pourra se connecter.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Lien d'invitation" className="ms-field min-w-0 flex-1 text-ms-ink" />
        <Button variant="primary" onClick={copy}>{copied ? "Copié" : "Copier"}</Button>
      </div>
      <p className="mt-2">
        Le lien ne sert qu&apos;une fois et expire (1 h par défaut dans Supabase). Passé ce délai, l&apos;enseignant peut
        utiliser « Mot de passe oublié » sur la page de connexion.
      </p>
      <Button variant="quiet" onClick={onClose} className="mt-1 -ml-3">Fermer</Button>
    </InlineNotice>
  );
}

/**
 * Équipe enseignante (admins) : comptes enseignants et droit admin. Déplacé
 * depuis le tableau de bord ; les API vérifient toujours le droit admin.
 */
export default function TeamPage() {
  const { user, isAdmin, handleLogout } = useTeacherSession();
  const [staff, setStaff] = useState<StaffRow[] | null | "error">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; link: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStaff().then(setStaff).catch(() => setStaff("error"));
  }, [isAdmin]);

  const toggleAdmin = async (row: StaffRow) => {
    setBusy(row.id);
    setMessage(null);
    try {
      const updated = await setStaffAdmin(row.id, !row.isAdmin);
      setStaff((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
      setMessage({ tone: "info", text: updated.isAdmin
        ? `${updated.name} est maintenant admin. Le droit s'applique à sa prochaine connexion.`
        : `${updated.name} n'est plus admin.` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Erreur inattendue" });
    } finally {
      setBusy(null);
    }
  };

  const onCreated = (created: CreatedTeacher) => {
    const row = created.user;
    setStaff((prev) => [...(Array.isArray(prev) ? prev : []), row].sort((a, b) => a.name.localeCompare(b.name)));
    if (created.emailSent) {
      setInvite(null);
      setMessage({ tone: "info", text: `Compte enseignant créé pour ${row.name}. Une invitation a été envoyée à ${row.email} : il y choisira son mot de passe.` });
    } else {
      setMessage(null);
      setInvite({ name: row.name, email: row.email, link: created.inviteLink });
    }
  };

  return (
    <TeacherShell name={user?.name || "Enseignant"} isAdmin={isAdmin} onLogout={handleLogout}>
      <div className="space-y-6">
        <header>
          <h1 className="text-[1.75rem] leading-9 lg:text-[2rem] lg:leading-10 font-semibold tracking-[-0.02em]">Équipe enseignante</h1>
          <p className="mt-1 text-ms-muted max-w-[65ch]">Un enseignant admin approuve les demandes de compte et peut modifier toutes les leçons.</p>
        </header>

        {user && !isAdmin ? (
          <InlineNotice>Cette page est réservée aux enseignants admin.</InlineNotice>
        ) : (
          <>
            <SectionHeader title="Comptes enseignants" actions={<NewTeacherForm onCreated={onCreated} />} />
            {invite && <InviteLinkBox {...invite} onClose={() => setInvite(null)} />}
            {message && <InlineNotice tone={message.tone}>{message.text}</InlineNotice>}
            <div className="ms-panel overflow-hidden">
              {staff === null && <SkeletonRows rows={2} label="Chargement de l'équipe" />}
              {staff === "error" && <div className="p-4"><InlineNotice tone="error">L&apos;équipe n&apos;a pas pu être chargée. Rechargez la page.</InlineNotice></div>}
              {Array.isArray(staff) && staff.length === 0 && <EmptyState title="Aucun enseignant." />}
              {Array.isArray(staff) && staff.length > 0 && (
                <ul className="divide-y divide-ms-line">
                  {staff.map((r) => {
                    const isMe = r.id === user?.id;
                    return (
                      <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {r.name}
                            {isMe && <span className="text-sm font-normal text-ms-muted">(vous)</span>}
                            {r.isAdmin && <StatusPill state="success">Admin</StatusPill>}
                          </p>
                          <p className="text-sm text-ms-muted [overflow-wrap:anywhere]">{r.email}</p>
                          {isMe && r.isAdmin && <p className="text-sm text-ms-muted">Vous ne pouvez pas retirer votre propre droit admin.</p>}
                        </div>
                        <Button
                          variant={r.isAdmin ? "secondary" : "primary"}
                          onClick={() => toggleAdmin(r)}
                          disabled={busy === r.id || (isMe && r.isAdmin)}
                        >
                          {busy === r.id ? "Enregistrement…" : r.isAdmin ? "Retirer admin" : "Nommer admin"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </TeacherShell>
  );
}
