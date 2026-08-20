"use client";
import { useState } from "react";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  };

  return (
    <div>
      <section className="bg-[#F5EEE8] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">📬</div>
          <h1 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>Me contacter</h1>
          <p className="text-[#2D2D2D]/50 text-lg">Une question, un besoin, une inscription ? Je réponds sous 48h.</p>
        </div>
      </section>

      <section className="py-16 px-4 bg-[#FFFDF8]">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          {/* Info */}
          <div>
            <h2 className="text-2xl font-black text-[#2D2D2D] mb-6" style={{ fontFamily: "'Fredoka One', cursive" }}>Mes coordonnées</h2>
            <div className="space-y-4 mb-8">
              {[
                { icon: MapPin, color: "#BB908E", label: "Zone",           val: "Bruxelles et périphérie (présentiel)" },
                { icon: Phone, color: "#6B705C", label: "Téléphone",       val: "Sur demande par email" },
                { icon: Mail,  color: "#8BA3B1", label: "Email",           val: "nassim.chouirfa@gmail.com" },
                { icon: Clock, color: "#999B84", label: "Délai de réponse",val: "Sous 48h" },
              ].map(({ icon: Icon, color, label, val }) => (
                <div key={label} className="flex items-start gap-4 p-4 rounded-2xl bg-[#F5EEE8] border border-[#EDE5D8]">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#2D2D2D]/40 uppercase tracking-wide">{label}</div>
                    <div className="font-semibold text-[#2D2D2D]">{val}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-5 bg-[#F5EEE8] border border-[#EDE5D8] text-sm text-[#2D2D2D]/65 leading-relaxed">
              Les cours en présentiel ont lieu à domicile dans Bruxelles et sa périphérie. Pour savoir si votre zone est couverte, écrivez-moi en précisant votre commune.
            </div>
          </div>

          {/* Formulaire */}
          <div>
            <h2 className="text-2xl font-black text-[#2D2D2D] mb-6" style={{ fontFamily: "'Fredoka One', cursive" }}>Envoyer un message</h2>
            {sent ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-bounce-in" style={{ background: "#6B705C" + "20" }}>
                  <CheckCircle size={40} style={{ color: "#6B705C" }} />
                </div>
                <h3 className="text-xl font-black text-[#2D2D2D] mb-2">Message envoyé !</h3>
                <p className="text-[#2D2D2D]/55">Je vous réponds sous 48h ouvrables.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { id: "name",    label: "Votre nom *", type: "text",  placeholder: "Marie Dupont" },
                  { id: "email",   label: "Email *",      type: "email", placeholder: "marie@exemple.be" },
                  { id: "subject", label: "Sujet",        type: "text",  placeholder: "Inscription, renseignement..." },
                ].map(({ id, label, type, placeholder }) => (
                  <div key={id}>
                    <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[id as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                      placeholder={placeholder}
                      required={id !== "subject"}
                      className="w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#BB908E] focus:ring-2 focus:ring-[#BB908E]/20 outline-none transition-all text-[#2D2D2D]"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-semibold text-[#2D2D2D]/70 mb-1">Message *</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Bonjour, je souhaite..."
                    required
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#BB908E] focus:ring-2 focus:ring-[#BB908E]/20 outline-none transition-all text-[#2D2D2D] resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70"
                  style={{ background: "#BB908E" }}
                >
                  {loading ? "Envoi en cours..." : <><Send size={16} /> Envoyer le message</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
