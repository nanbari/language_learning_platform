"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Inbox, Mail, Phone, UserMinus, X } from "lucide-react";
import { fetchSignupRequests, reviewSignupRequest } from "@/lib/api/signup";
import type { SignupRequestRow } from "@/lib/signup";
import { decideEnrollment, fetchEnrollments } from "@/lib/api/enrollment";
import {
  LEVEL_LABELS, LETTER_KNOWLEDGE_LABELS, VOCABULARY_LABELS, VOCABULARY_DOMAIN_LABELS, RETENTION_CLOSED_MONTHS,
  type EnrollmentAction, type EnrollmentRow, type LetterKnowledge,
} from "@/lib/enrollment";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { Button, ICON_STROKE, InlineNotice, StatusPill } from "@/components/platform/ui";
import { relativeDay } from "@/components/teacher/ProgressWorkspace";

/** Lettres connues d'une demande, en glyphes isolés, dans l'ordre de l'alphabet. */
function knownLetterGlyphs(ids: number[]): string {
  return ARABIC_ALPHABET.filter((l) => ids.includes(l.id)).map((l) => l.isolated).join(" ");
}

/** Réponse « aucune / quelques-unes (lettres) / toutes » à l'une des deux questions sur les lettres. */
function letterAnswer(knowledge: LetterKnowledge | null, ids: number[] | null) {
  if (knowledge === "some" && ids && ids.length > 0) {
    return <>{LETTER_KNOWLEDGE_LABELS.some} : <span lang="ar" dir="rtl" className="text-base text-ms-ink">{knownLetterGlyphs(ids)}</span></>;
  }
  return knowledge ? LETTER_KNOWLEDGE_LABELS[knowledge].toLowerCase() : null;
}

/** Ce que la famille a dit du niveau (lettres, vocabulaire) ; vide pour les demandes d'avant novembre 2026. */
function LevelDetails({ r }: { r: EnrollmentRow }) {
  if (!r.letters && !r.vocabulary) return null;
  const letters = letterAnswer(r.letters, r.known_letters);
  // Formes attachées (début, milieu, fin) : demandées au débutant qui connaît toutes les lettres isolées.
  const forms = letterAnswer(r.letter_forms, r.known_letter_forms);
  const domains = [
    ...(r.vocabulary_domains ?? []).map((d) => VOCABULARY_DOMAIN_LABELS[d] ?? d),
    ...(r.vocabulary_other ? [r.vocabulary_other] : []),
  ];
  return (
    <p className="mt-1 text-ms-muted">
      {letters && <>Lettres : {letters}</>}
      {forms && <> · Lettres attachées : {forms}</>}
      {letters && r.vocabulary && " · "}
      {r.vocabulary && <>Vocabulaire : {VOCABULARY_LABELS[r.vocabulary].toLowerCase()}{domains.length > 0 && <> ({domains.join(", ")})</>}</>}
    </p>
  );
}

/** Où en est la demande, et ce que la conservation (mention RGPD du formulaire) en fera. */
function statusLine(r: EnrollmentRow): string | null {
  const when = (iso: string) => relativeDay(iso).toLowerCase();
  if (r.status === "enrolled") {
    if (r.ended_at) return `inscription terminée ${when(r.ended_at)}, effacée un an plus tard`;
    return r.handled_at ? `inscrit ${when(r.handled_at)}` : "inscrit";
  }
  if (r.status === "closed") {
    return `${r.handled_at ? `sans suite ${when(r.handled_at)}` : "sans suite"}, effacée ${RETENTION_CLOSED_MONTHS} mois plus tard`;
  }
  return null;
}

/** null = chargement ; "error" = échec du chargement (à ne pas confondre avec une liste vide). */
type Loaded<T> = T[] | null | "error";

/** Une demande d'inscription : l'enfant, ce que la famille a dit de son niveau, les coordonnées. */
function EnrollmentItem({ r, children }: { r: EnrollmentRow; children?: React.ReactNode }) {
  const status = statusLine(r);
  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          {r.child_name}, {r.child_age} ans <span className="font-normal text-ms-muted">· {LEVEL_LABELS[r.level].title}</span>
        </p>
        <LevelDetails r={r} />
        <p className="text-ms-muted">
          {r.parent_name} · {relativeDay(r.created_at)}
          {status && <> · {status}</>}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a href={`mailto:${r.email}`} className="inline-flex min-h-11 items-center gap-1.5 [overflow-wrap:anywhere] text-ms-ink underline-offset-2 hover:underline">
            <Mail size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> {r.email}
          </a>
          <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-1.5 text-ms-ink underline-offset-2 hover:underline">
            <Phone size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> {r.phone}
          </a>
        </p>
      </div>
      {children}
    </li>
  );
}

function Category({ title, help, items, done = false, children }: {
  title: string; help: React.ReactNode; items: Loaded<unknown>;
  /** Liste d'archives : le compteur ne parle pas d'attente. */
  done?: boolean; children: React.ReactNode;
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
          ? (done ? <span className="text-sm text-ms-muted">{count}</span> : <StatusPill state="review">{count} en attente</StatusPill>)
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
 *
 * Une demande d'inscription est soit « inscrit » (coordonnées conservées tant
 * que l'enfant suit les cours, puis un an après « Fin d'inscription »), soit
 * « sans suite » (effacée 6 mois plus tard). Les effacements sont faits par la
 * base ; ici on ne fait qu'enregistrer la décision.
 */
export default function RequestInbox() {
  const [pending, setPending] = useState<Loaded<EnrollmentRow>>(null);
  const [enrolled, setEnrolled] = useState<Loaded<EnrollmentRow>>(null);
  const [closed, setClosed] = useState<Loaded<EnrollmentRow>>(null);
  const [signups, setSignups] = useState<Loaded<SignupRequestRow>>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchEnrollments()
      .then((r) => { setPending(r.pending); setEnrolled(r.enrolled); setClosed(r.closed); })
      .catch(() => { setPending("error"); setEnrolled("error"); setClosed("error"); });
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

  const decide = (id: string, action: EnrollmentAction) => run(id, async () => {
    const done = await decideEnrollment(id, action);
    if (action === "end") {
      setEnrolled((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === done.id ? done : r)) : prev));
      return `Inscription de ${done.child_name} terminée. Ses informations seront effacées automatiquement dans un an.`;
    }
    setPending((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== done.id) : prev));
    if (action === "enroll") {
      setEnrolled((prev) => (Array.isArray(prev) ? [done, ...prev] : [done]));
      return `Inscription de ${done.child_name} enregistrée. Les coordonnées de ${done.parent_name} restent dans « Enfants inscrits ».`;
    }
    setClosed((prev) => (Array.isArray(prev) ? [done, ...prev] : [done]));
    return `Demande de ${done.parent_name} pour ${done.child_name} classée sans suite. Elle sera effacée automatiquement dans ${RETENTION_CLOSED_MONTHS} mois.`;
  });

  const review = (id: string, action: "approve" | "reject") => run(id, async () => {
    const done = await reviewSignupRequest(id, action);
    setSignups((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== id) : prev));
    return action === "approve" ? `Compte créé pour ${done.name} (${done.email}).` : `Demande de ${done.name} refusée.`;
  });

  const empty = Array.isArray(pending) && Array.isArray(signups) && pending.length + signups.length === 0;

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
        items={pending}
        help={<>Envoyées depuis le formulaire <Link href="/demande-inscription" className="font-semibold text-ms-ink underline underline-offset-2">demande d&apos;inscription</Link>. Recontactez la famille, puis indiquez si l&apos;enfant est inscrit ou si la demande reste sans suite.</>}
      >
        {pending === "error" && <InlineNotice tone="error">Les demandes d&apos;inscription n&apos;ont pas pu être chargées. Rechargez la page.</InlineNotice>}
        {Array.isArray(pending) && pending.length > 0 && (
          <ul className="divide-y divide-ms-line rounded-xl border border-ms-line">
            {pending.map((r) => (
              <EnrollmentItem key={r.id} r={r}>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => decide(r.id, "close")} disabled={busy === r.id}>
                    <X size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Sans suite
                  </Button>
                  <Button variant="primary" onClick={() => decide(r.id, "enroll")} disabled={busy === r.id}>
                    <Check size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {busy === r.id ? "Enregistrement…" : "Inscrit"}
                  </Button>
                </div>
              </EnrollmentItem>
            ))}
          </ul>
        )}
      </Category>

      <Category
        title="Enfants inscrits"
        items={enrolled}
        done
        help="Les coordonnées des familles inscrites restent ici tant que l'enfant suit les cours. Quand il arrête, cliquez « Fin d'inscription » : la demande est effacée automatiquement un an plus tard."
      >
        {enrolled === "error" && <InlineNotice tone="error">Les enfants inscrits n&apos;ont pas pu être chargés. Rechargez la page.</InlineNotice>}
        {Array.isArray(enrolled) && enrolled.length > 0 && (
          <ul className="divide-y divide-ms-line rounded-xl border border-ms-line">
            {enrolled.map((r) => (
              <EnrollmentItem key={r.id} r={r}>
                {!r.ended_at && (
                  <Button variant="secondary" onClick={() => decide(r.id, "end")} disabled={busy === r.id}>
                    <UserMinus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> {busy === r.id ? "Enregistrement…" : "Fin d'inscription"}
                  </Button>
                )}
              </EnrollmentItem>
            ))}
          </ul>
        )}
      </Category>

      <Category
        title="Demandes sans suite"
        items={closed}
        done
        help={`Familles recontactées sans inscription, les plus récentes d'abord. Chaque demande est effacée automatiquement ${RETENTION_CLOSED_MONTHS} mois après avoir été classée.`}
      >
        {closed === "error" && <InlineNotice tone="error">Les demandes sans suite n&apos;ont pas pu être chargées. Rechargez la page.</InlineNotice>}
        {Array.isArray(closed) && closed.length > 0 && (
          <ul className="divide-y divide-ms-line rounded-xl border border-ms-line">
            {closed.map((r) => <EnrollmentItem key={r.id} r={r} />)}
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
                  <Button variant="danger" onClick={() => review(r.id, "reject")} disabled={busy === r.id}>
                    <X size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Refuser
                  </Button>
                  <Button variant="primary" onClick={() => review(r.id, "approve")} disabled={busy === r.id}>
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
