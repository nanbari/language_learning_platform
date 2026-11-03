"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Inbox, Mail, Phone, X } from "lucide-react";
import { fetchSignupRequests, reviewSignupRequest } from "@/lib/api/signup";
import type { SignupRequestRow } from "@/lib/signup";
import { fetchEnrollments, markEnrollmentHandled } from "@/lib/api/enrollment";
import { LEVEL_LABELS, type EnrollmentRow } from "@/lib/enrollment";
import { Button, ICON_STROKE, InlineNotice, StatusPill } from "@/components/platform/ui";
import { relativeDay } from "@/components/teacher/ProgressWorkspace";

/** null = chargement ; "error" = échec du chargement (à ne pas confondre avec une liste vide). */
type Loaded<T> = T[] | null | "error";

function Category({ title, help, items, children }: {
  title: string; help: React.ReactNode; items: Loaded<unknown>; children: React.ReactNode;
}) {
  const count = Array.isArray(items) ? items.length : 0;
  return (
    <details className="group border-b border-ms-line last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 hover:bg-ms-canvas/60">
        <ChevronDown size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="flex-shrink-0 -rotate-90 text-ms-muted transition-transform duration-[180ms] group-open:rotate-0" />
        <span className="min-w-0 flex-1 font-semibold">{title}</span>
        {items === null && <span className="text-sm text-ms-muted">Chargement…</span>}
        {items === "error" && <StatusPill state="error">Non chargé</StatusPill>}
        {Array.isArray(items) && (count > 0
          ? <StatusPill state="review">{count} en attente</StatusPill>
          : <span className="text-sm text-ms-muted">Aucune</span>)}
      </summary>
      <div className="px-4 pb-4 sm:px-5">
        <p className="mb-3 text-sm text-ms-muted">{help}</p>
        {children}
      </div>
    </details>
  );
}

/**
 * « À traiter » (admins) : inscriptions des familles et comptes élèves à
 * valider, dans un seul encadré compact. Mêmes API et mêmes actions qu'avant ;
 * les droits restent vérifiés côté serveur.
 */
export default function RequestInbox() {
  const [enrollments, setEnrollments] = useState<Loaded<EnrollmentRow>>(null);
  const [signups, setSignups] = useState<Loaded<SignupRequestRow>>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchEnrollments().then(setEnrollments).catch(() => setEnrollments("error"));
    fetchSignupRequests().then((r) => setSignups(r.pending)).catch(() => setSignups("error"));
  }, []);

  const run = async (id: string, action: () => Promise<string>) => {
    setBusy(id);
    setMessage(null);
    try {
      setMessage({ tone: "info", text: await action() });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Erreur inattendue" });
    } finally {
      setBusy(null);
    }
  };

  const handleEnrollment = (id: string) => run(id, async () => {
    const done = await markEnrollmentHandled(id);
    setEnrollments((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== id) : prev));
    return `Demande de ${done.parent_name} pour ${done.child_name} marquée comme traitée.`;
  });

  const decide = (id: string, action: "approve" | "reject") => run(id, async () => {
    const done = await reviewSignupRequest(id, action);
    setSignups((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== id) : prev));
    return action === "approve" ? `Compte créé pour ${done.name} (${done.email}).` : `Demande de ${done.name} refusée.`;
  });

  const empty = Array.isArray(enrollments) && Array.isArray(signups) && enrollments.length + signups.length === 0;

  return (
    <section aria-labelledby="a-traiter" className="ms-panel flex flex-col overflow-hidden">
      <div className="border-b border-ms-line bg-ms-blush-soft px-4 py-4 sm:px-5">
        <h2 id="a-traiter" className="flex items-center gap-3 text-xl leading-7 font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ms-surface text-ms-blush-ink">
            <Inbox size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </span>
          À traiter
        </h2>
        {empty && <p className="mt-1 text-sm text-ms-muted">Aucune demande en attente.</p>}
      </div>
      {message && <div className="px-4 pt-4 sm:px-5"><InlineNotice tone={message.tone}>{message.text}</InlineNotice></div>}

      <Category
        title="Inscriptions des familles"
        items={enrollments}
        help={<>Envoyées depuis le formulaire <Link href="/demande-inscription" className="font-semibold text-ms-ink underline underline-offset-2">demande d&apos;inscription</Link>. Recontactez la famille, puis marquez la demande comme traitée.</>}
      >
        {enrollments === "error" && <InlineNotice tone="error">Les demandes d&apos;inscription n&apos;ont pas pu être chargées. Rechargez la page.</InlineNotice>}
        {Array.isArray(enrollments) && enrollments.length > 0 && (
          <ul className="divide-y divide-ms-line rounded-xl border border-ms-line">
            {enrollments.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">
                    {r.child_name}, {r.child_age} ans <span className="font-normal text-ms-muted">· {LEVEL_LABELS[r.level].title}</span>
                  </p>
                  <p className="text-ms-muted">{r.parent_name} · {relativeDay(r.created_at)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <a href={`mailto:${r.email}`} className="inline-flex min-h-11 items-center gap-1.5 [overflow-wrap:anywhere] text-ms-ink underline-offset-2 hover:underline">
                      <Mail size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> {r.email}
                    </a>
                    <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-1.5 text-ms-ink underline-offset-2 hover:underline">
                      <Phone size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> {r.phone}
                    </a>
                  </p>
                </div>
                <Button variant="primary" onClick={() => handleEnrollment(r.id)} disabled={busy === r.id}>
                  <Check size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {busy === r.id ? "Enregistrement…" : "Marquer traitée"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Category>

      <Category title="Comptes élèves à valider" items={signups} help="Le compte n'est créé qu'après votre approbation.">
        {signups === "error" && <InlineNotice tone="error">Les demandes de compte n&apos;ont pas pu être chargées. Rechargez la page.</InlineNotice>}
        {Array.isArray(signups) && signups.length > 0 && (
          <ul className="divide-y divide-ms-line rounded-xl border border-ms-line">
            {signups.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-ms-muted"><span className="[overflow-wrap:anywhere]">{r.email}</span> · {relativeDay(r.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" onClick={() => decide(r.id, "reject")} disabled={busy === r.id}>
                    <X size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Refuser
                  </Button>
                  <Button variant="primary" onClick={() => decide(r.id, "approve")} disabled={busy === r.id}>
                    <Check size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {busy === r.id ? "Enregistrement…" : "Approuver"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Category>
    </section>
  );
}
