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
import { submitEnrollment } from "@/lib/enrollmentApi";
import { ENROLLMENT_LEVELS, LEVEL_LABELS, MAX_CHILD_AGE, MAX_CHILDREN, MIN_CHILD_AGE, type EnrollmentLevel } from "@/lib/enrollment";

const AGES = Array.from({ length: MAX_CHILD_AGE - MIN_CHILD_AGE + 1 }, (_, i) => MIN_CHILD_AGE + i);

/** Enfant en cours de saisie ; `key` reste stable quand on en retire un. */
interface ChildDraft { key: number; name: string; age: string; level: EnrollmentLevel | null }

export default function EnrollmentPage() {
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const nextKey = useRef(1);
  const [children, setChildren] = useState<ChildDraft[]>([{ key: 0, name: "", age: "", level: null }]);
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
    setChildren((prev) => [...prev, { key, name: "", age: "", level: null }]);
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
    if (!consent) return setError("Votre accord est nécessaire pour envoyer la demande.");
    setLoading(true);
    try {
      await submitEnrollment({
        parentName, email, phone, consent: true, website,
        children: children.map((c) => ({ name: c.name, age: Number(c.age), level: c.level as EnrollmentLevel })),
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
              <p className="text-xs text-left text-[#2D2D2D]/50 leading-none" style={{ fontFamily: "'Caveat', cursive" }}>
                ASBL
              </p>
              <span className="font-black text-xl text-[#2D2D2D] leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Monte <span className="text-[#8BA3B1]">&</span> So<span className="text-[#BB908E]">u</span>ri<span className="text-[#999B84]">s</span>
              </span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl text-[#2D2D2D]" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Demande d&apos;inscription aux cours d&apos;arabe
          </h1>
          <p className="text-[#2D2D2D]/60 text-sm mt-2 leading-relaxed">
            Cours en ligne pour les enfants non arabophones de {MIN_CHILD_AGE} à {MAX_CHILD_AGE} ans,
            en petit groupe de 6 élèves maximum, inspirés de la pédagogie Montessori.
          </p>
          <p className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#EDE5D8] text-sm text-[#2D2D2D]">
            Début des cours : <strong className="text-[#6B705C]">dimanche 15 novembre 2026</strong>
            <span className="block mt-1"><strong className="text-[#6B705C]">35 € par mois</strong>, sans engagement</span>
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
