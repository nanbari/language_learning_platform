"use client";
/**
 * Demande d'inscription aux cours d'arabe (page publique) : un parent, un ou
 * plusieurs enfants.
 *
 * Lien partagé avec la vidéo de présentation. Aucun compte n'est créé :
 * la demande arrive dans le tableau de bord des admins, qui recontactent
 * la famille. Voir src/lib/enrollment.ts.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, Plus, Send, X } from "lucide-react";
import { submitEnrollment } from "@/lib/api/enrollment";
import {
  ENROLLMENT_LEVELS, LEVEL_LABELS, MAX_CHILD_AGE, MAX_CHILDREN, MIN_CHILD_AGE, MAX_VOCABULARY_OTHER,
  LETTER_KNOWLEDGE, LETTER_KNOWLEDGE_LABELS, VOCABULARY_LEVELS, VOCABULARY_LABELS, VOCABULARY_DOMAINS, VOCABULARY_DOMAIN_LABELS,
  type EnrollmentLevel, type LetterKnowledge, type VocabularyLevel, type VocabularyDomain,
} from "@/lib/enrollment";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";

const AGES = Array.from({ length: MAX_CHILD_AGE - MIN_CHILD_AGE + 1 }, (_, i) => MIN_CHILD_AGE + i);

/** Enfant en cours de saisie ; `key` reste stable quand on en retire un. */
interface ChildDraft {
  key: number; name: string; age: string; level: EnrollmentLevel | null;
  letters: LetterKnowledge | null; knownLetters: number[];
  vocabulary: VocabularyLevel | null; vocabularyDomains: VocabularyDomain[]; vocabularyOther: string;
}
const emptyChild = (key: number): ChildDraft =>
  ({ key, name: "", age: "", level: null, letters: null, knownLetters: [], vocabulary: null, vocabularyDomains: [], vocabularyOther: "" });

/** Ajoute ou retire une valeur d'une liste (cases à cocher). */
function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value);
}

export default function EnrollmentPage() {
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const nextKey = useRef(1);
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild(0)]);
  const [consent, setConsent] = useState(false);
  // Champ piège invisible : seuls les robots le remplissent.
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const updateChild = (key: number, patch: Partial<ChildDraft>) =>
    setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const addChild = () => {
    // Clé tirée hors de la fonction de mise à jour, que React peut rejouer.
    const key = nextKey.current++;
    setChildren((prev) => [...prev, emptyChild(key)]);
  };
  const removeChild = (key: number) => setChildren((prev) => prev.filter((c) => c.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Le niveau et l'accord n'ont pas de « required » natif fiable.
    const missing = children.findIndex((c) => !c.level);
    if (missing >= 0) {
      return setError(children.length > 1 ? `Choisissez le niveau de l'enfant ${missing + 1}.` : "Choisissez le niveau de l'enfant.");
    }
    for (const [i, c] of children.entries()) {
      const who = children.length > 1 ? `Enfant ${i + 1} : ` : "";
      if (!c.letters) return setError(`${who}indiquez s'il connaît des lettres.`);
      if (c.letters === "some" && c.knownLetters.length === 0) return setError(`${who}cochez les lettres qu'il connaît.`);
      if (!c.vocabulary) return setError(`${who}indiquez s'il a du vocabulaire.`);
      if (c.vocabulary !== "none" && c.vocabularyDomains.length === 0 && !c.vocabularyOther.trim()) {
        return setError(`${who}indiquez dans quels domaines il a du vocabulaire.`);
      }
    }
    if (!consent) return setError("Votre accord est nécessaire pour envoyer la demande.");
    setLoading(true);
    try {
      await submitEnrollment({
        parentName, email, phone, consent: true, website,
        children: children.map((c) => ({
          name: c.name, age: Number(c.age), level: c.level as EnrollmentLevel,
          letters: c.letters as LetterKnowledge,
          knownLetters: c.letters === "some" ? c.knownLetters : [],
          vocabulary: c.vocabulary as VocabularyLevel,
          vocabularyDomains: c.vocabulary === "none" ? [] : c.vocabularyDomains,
          vocabularyOther: c.vocabulary === "none" ? null : c.vocabularyOther.trim() || null,
        })),
      });
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#6B705C] focus:ring-2 focus:ring-[#6B705C]/20 outline-none transition-all text-[#2D2D2D]";
  const label = "block text-sm font-semibold text-[#2D2D2D]/70 mb-1";
  const sectionTitle = "text-xs font-black uppercase tracking-wide text-[#6B705C] mb-3";
  const hint = "text-xs text-[#2D2D2D]/50 mb-2";
  // Pastille cochable (choix courts) : même code couleur que les cartes de niveau.
  const pill = (on: boolean) =>
    `inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all ${
      on ? "border-[#6B705C] bg-[#999B84]/10 text-[#2D2D2D]" : "border-[#EDE5D8] text-[#2D2D2D]/70 hover:border-[#999B84]"
    }`;
  const names = children.map((c) => c.name.trim());
  const namesText = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];

  return (
    <div className="min-h-screen bg-[#F5EEE8] px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-6">
          {/* Même logo que les pages de compte (connexion, AuthShell) */}
          <Link href="/" className="inline-flex items-end gap-3 group mb-6" aria-label="Monte & Souris, accueil">
            <div className="relative w-10 h-10 flex items-end justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="group-hover:scale-110 transition-transform">
                <rect x="1"  y="28" width="11" height="11" rx="2" stroke="#BB908E" strokeWidth="2.5"/>
                <rect x="14" y="20" width="12" height="19" rx="2" stroke="#8BA3B1" strokeWidth="2.5"/>
                <rect x="28" y="10" width="11" height="29" rx="2" stroke="#999B84" strokeWidth="2.5"/>
                <text x="2" y="10" fontSize="7" fill="#999B84">★</text>
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <p className="text-xs text-left text-[#2D2D2D]/50 leading-none" style={{ fontStyle: "italic" }}>
                ASBL
              </p>
              <span className="font-black text-xl text-[#2D2D2D] leading-none" style={{ fontFamily: "var(--font-fredoka), sans-serif", fontWeight: 700 }}>
                Monte <span className="text-[#8BA3B1]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
              </span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl text-[#2D2D2D]">
            Demande d&apos;inscription aux cours d&apos;arabe
          </h1>
          <p className="text-[#2D2D2D]/60 text-sm mt-2 leading-relaxed">
            Cours en ligne pour les enfants à partir de {MIN_CHILD_AGE} ans,
            en petit groupe de 6 élèves maximum, inspirés de la pédagogie Montessori.
          </p>
          <p className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#EDE5D8] text-sm text-[#2D2D2D]">
            Début des cours : <strong className="text-[#6B705C]">mercredi 6 janvier 2027</strong>
            <span className="block mt-1">Un cours d&apos;essai, puis <strong className="text-[#6B705C]">35 € par mois</strong> jusqu&apos;au dimanche 4 juillet 2027</span>
            <span className="block text-xs text-[#2D2D2D]/50">
              par enfant : une séance de 50 minutes par semaine
              <br />et l&apos;accès à la plateforme de révision entre les cours
            </span>
          </p>
        </div>

        <div className="bg-[#FFFDF8] rounded-3xl shadow-lg p-6 sm:p-8 border border-[#EDE5D8]">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#999B8420" }}>
                <CheckCircle size={28} style={{ color: "#6B705C" }} />
              </div>
              <h2 className="text-xl font-black text-[#2D2D2D] mb-2">Merci, demande envoyée !</h2>
              <p className="text-[#2D2D2D]/60 text-sm mb-6 leading-relaxed">
                Nous avons bien reçu la demande d&apos;inscription de <strong>{namesText}</strong>.
                Nous vous recontacterons pour vous proposer {children.length > 1 ? "un groupe adapté au niveau de chacun" : "un groupe de son niveau"}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-7">
              <fieldset>
                <legend className={sectionTitle}>Le parent</legend>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="parentName" className={label}>Nom et prénom</label>
                    <input id="parentName" type="text" value={parentName} onChange={(e) => setParentName(e.target.value)}
                      required minLength={2} maxLength={80} autoComplete="name" className={input} />
                  </div>
                  <div>
                    <label htmlFor="email" className={label}>Adresse e-mail</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      required autoComplete="email" inputMode="email" className={input} />
                  </div>
                  <div>
                    <label htmlFor="phone" className={label}>Téléphone ou WhatsApp</label>
                    <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      required maxLength={30} autoComplete="tel" inputMode="tel" placeholder="+32 4.. .. .. .." className={input} />
                  </div>
                </div>
              </fieldset>

              {children.map((child, i) => (
                <fieldset key={child.key}>
                  {/* La légende reste le premier enfant du fieldset (accessibilité). */}
                  <legend className="w-full flex items-center justify-between mb-3">
                    <span className={`${sectionTitle} mb-0`}>
                      {children.length > 1 ? `Enfant ${i + 1}` : "L'enfant"}
                    </span>
                    {children.length > 1 && (
                      <button type="button" onClick={() => removeChild(child.key)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#2D2D2D]/40 hover:text-red-400 transition-colors">
                        <X size={14} /> Retirer
                      </button>
                    )}
                  </legend>
                  <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_7.5rem] gap-3">
                      <div>
                        <label htmlFor={`childName-${child.key}`} className={label}>Prénom</label>
                        <input id={`childName-${child.key}`} type="text" value={child.name}
                          onChange={(e) => updateChild(child.key, { name: e.target.value })}
                          required maxLength={80} autoComplete="off" className={input} />
                      </div>
                      <div>
                        <label htmlFor={`childAge-${child.key}`} className={label}>Âge</label>
                        <select id={`childAge-${child.key}`} value={child.age}
                          onChange={(e) => updateChild(child.key, { age: e.target.value })} required className={input}>
                          <option value="" disabled>—</option>
                          {AGES.map((a) => <option key={a} value={a}>{a} ans</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <p className={label}>Niveau en arabe</p>
                      <div className="grid gap-2" role="radiogroup" aria-label="Niveau en arabe">
                        {ENROLLMENT_LEVELS.map((l) => (
                          <label key={l}
                            className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                              child.level === l ? "border-[#6B705C] bg-[#999B84]/10" : "border-[#EDE5D8] hover:border-[#999B84]"
                            }`}>
                            <input type="radio" name={`level-${child.key}`} value={l} checked={child.level === l}
                              onChange={() => updateChild(child.key, { level: l })} className="mt-1 accent-[#6B705C]" />
                            <span>
                              <span className="block font-bold text-[#2D2D2D]">{LEVEL_LABELS[l].title}</span>
                              <span className="block text-xs text-[#2D2D2D]/50">{LEVEL_LABELS[l].hint}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className={label}>Reconnaît-il des lettres isolées de l&apos;alphabet arabe ?</p>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Lettres connues">
                        {LETTER_KNOWLEDGE.map((k) => (
                          <label key={k} className={pill(child.letters === k)}>
                            <input type="radio" name={`letters-${child.key}`} value={k} checked={child.letters === k}
                              onChange={() => updateChild(child.key, { letters: k })} className="accent-[#6B705C]" />
                            {LETTER_KNOWLEDGE_LABELS[k]}
                          </label>
                        ))}
                      </div>
                      {child.letters === "some" && (
                        <div className="mt-3">
                          <p className={hint}>Cochez les lettres isolées qu&apos;il reconnaît.</p>
                          <div dir="rtl" className="grid grid-cols-7 gap-2" role="group" aria-label="Lettres qu'il reconnaît">
                            {ARABIC_ALPHABET.map((l) => {
                              const on = child.knownLetters.includes(l.id);
                              return (
                                <label key={l.id} title={l.nameTranslit}
                                  className={`flex flex-col items-center justify-center rounded-xl border-2 py-2 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#6B705C]/40 ${
                                    on ? "border-[#6B705C] bg-[#999B84]/10" : "border-[#EDE5D8] hover:border-[#999B84]"
                                  }`}>
                                  <input type="checkbox" className="sr-only" checked={on} aria-label={l.nameTranslit}
                                    onChange={(e) => updateChild(child.key, { knownLetters: toggle(child.knownLetters, l.id, e.target.checked) })} />
                                  <span lang="ar" className="text-2xl leading-none text-[#2D2D2D]">{l.isolated}</span>
                                  <span dir="ltr" className="mt-1 text-[10px] leading-none text-[#2D2D2D]/50">{l.nameTranslit}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className={label}>A-t-il du vocabulaire en arabe ?</p>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vocabulaire">
                        {VOCABULARY_LEVELS.map((v) => (
                          <label key={v} className={pill(child.vocabulary === v)}>
                            <input type="radio" name={`vocabulary-${child.key}`} value={v} checked={child.vocabulary === v}
                              onChange={() => updateChild(child.key, { vocabulary: v })} className="accent-[#6B705C]" />
                            {VOCABULARY_LABELS[v]}
                          </label>
                        ))}
                      </div>
                      {child.vocabulary && child.vocabulary !== "none" && (
                        <div className="mt-3">
                          <p className={hint}>Dans quels domaines ?</p>
                          <div className="flex flex-wrap gap-2" role="group" aria-label="Domaines de vocabulaire">
                            {VOCABULARY_DOMAINS.map((d) => (
                              <label key={d} className={pill(child.vocabularyDomains.includes(d))}>
                                <input type="checkbox" checked={child.vocabularyDomains.includes(d)}
                                  onChange={(e) => updateChild(child.key, { vocabularyDomains: toggle(child.vocabularyDomains, d, e.target.checked) })}
                                  className="accent-[#6B705C]" />
                                {VOCABULARY_DOMAIN_LABELS[d]}
                              </label>
                            ))}
                          </div>
                          <label htmlFor={`vocabOther-${child.key}`} className={`${label} mt-3`}>Autres domaines (facultatif)</label>
                          <input id={`vocabOther-${child.key}`} type="text" value={child.vocabularyOther}
                            onChange={(e) => updateChild(child.key, { vocabularyOther: e.target.value })}
                            maxLength={MAX_VOCABULARY_OTHER} placeholder="Par exemple : les jours de la semaine, les fruits…" className={input} />
                        </div>
                      )}
                    </div>
                  </div>
                </fieldset>
              ))}

              {children.length < MAX_CHILDREN && (
                <button type="button" onClick={addChild}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[#999B84] text-[#6B705C] font-bold flex items-center justify-center gap-2 hover:bg-[#999B84]/10 transition-all">
                  <Plus size={16} /> Ajouter un enfant
                </button>
              )}

              {/* Champ piège : caché aux humains, rempli par les robots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                <label htmlFor="website">Site web</label>
                <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              <label className="flex items-start gap-3 text-sm text-[#2D2D2D]/70 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-[#6B705C] flex-shrink-0" />
                <span>J&apos;accepte que l&apos;ASBL Monte &amp; Souris utilise ces informations pour organiser les cours et me recontacter.</span>
              </label>

              {error && <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-2 border border-red-100" role="alert">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.01] transition-all disabled:opacity-70"
                style={{ background: "#6B705C" }}>
                {loading ? "Envoi…" : <><Send size={16} /> Envoyer la demande</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
