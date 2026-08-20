"use client";
import { useState } from "react";
import { MapPin, Phone, Mail, Send, CheckCircle } from "lucide-react";

export default function ContactSection() {
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
    <section id="contact" className="py-16 px-4 bg-[#EDE5D8] scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-[#2D2D2D] mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Contactez-nous
          </h2>
          <p className="text-[#2D2D2D]/50 text-lg">Notre équipe est là pour répondre à toutes vos questions</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Coordonnées */}
          <div>
            <h3 className="text-2xl font-black text-[#2D2D2D] mb-6" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Nos coordonnées
            </h3>
            <div className="space-y-4 mb-8">
              {[
                { icon: MapPin, color: "#BB908E", label: "Adresse",        val: "Rue Edmond Tollenaere, 1020 Bruxelles" },
                { icon: Phone, color: "#6B705C",  label: "Téléphone",       val: "+32 499 28 97 66" },
                { icon: Mail,  color: "#8BA3B1",  label: "Email",           val: "nabilaanbari@zohomail.eu" },
              ].map(({ icon: Icon, color, label, val }) => (
                <div key={label} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FFFDF8] border border-[#EDE5D8]">
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

            <div className="rounded-2xl overflow-hidden shadow-md border border-[#EDE5D8]">
              <iframe
                src="https://maps.google.com/maps?q=Rue%20Edmond%20Tollenaere%2C%201020%20Bruxelles&t=&z=16&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="220"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Monte & Souris sur Google Maps"
              />
            </div>
          </div>

          {/* Formulaire */}
          <div>
            <h3 className="text-2xl font-black text-[#2D2D2D] mb-6" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Envoyer un message
            </h3>
            {sent ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-bounce-in" style={{ background: "#6B705C20" }}>
                  <CheckCircle size={40} style={{ color: "#6B705C" }} />
                </div>
                <h3 className="text-xl font-black text-[#2D2D2D] mb-2">Message envoyé !</h3>
                <p className="text-[#2D2D2D]/55">Nous vous répondrons dans les 24h ouvrables.</p>
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
                      className="w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#FFFDF8] focus:border-[#BB908E] focus:ring-2 focus:ring-[#BB908E]/20 outline-none transition-all text-[#2D2D2D]"
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
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#FFFDF8] focus:border-[#BB908E] focus:ring-2 focus:ring-[#BB908E]/20 outline-none transition-all text-[#2D2D2D] resize-none"
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
      </div>
    </section>
  );
}
