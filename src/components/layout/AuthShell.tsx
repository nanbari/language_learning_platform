import Link from "next/link";

/** Cadre des pages de compte (mot de passe oublié…) : logo, titre, carte. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5EEE8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-end gap-3 group mb-6">
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
          <h1 className="text-2xl font-black text-[#2D2D2D]">{title}</h1>
          <p className="text-[#2D2D2D]/50 text-sm mt-1">{subtitle}</p>
        </div>
        <div className="bg-[#FFFDF8] rounded-3xl shadow-lg p-8 border border-[#EDE5D8]">{children}</div>
        <p className="text-center text-sm text-[#2D2D2D]/50 mt-6">
          <Link href="/login" className="text-[#6B705C] hover:underline font-semibold">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full px-4 py-3 rounded-xl border border-[#EDE5D8] bg-[#F5EEE8]/50 focus:border-[#6B705C] focus:ring-2 focus:ring-[#6B705C]/20 outline-none transition-all text-[#2D2D2D]";

export const authButtonClass =
  "w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-70";
