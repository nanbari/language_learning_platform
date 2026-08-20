"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ARABIC_ALPHABET, ArabicLetter } from "@/data/arabicAlphabet";

export default function AlphabetPage() {
  const [selected, setSelected] = useState<ArabicLetter | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f8ff] via-[#fffef9] to-[#f0faf5]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/arabic" className="flex items-center gap-2 text-gray-500 hover:text-[#74c2e8] transition-colors">
          <ArrowLeft size={18} /> Retour
        </Link>
        <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          الأَلِفْبَاء — Alphabet
        </span>
        <div className="w-20" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🔤</div>
          <h1 className="text-3xl font-black text-[#2d2d2d] mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Les 28 lettres arabes
          </h1>
          <p className="text-[#8b6f47] font-semibold">Niveau 1 — Clique sur une lettre pour la découvrir</p>
        </div>

        {/* Letter grid */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-8">
          {ARABIC_ALPHABET.map((letter) => (
            <button
              key={letter.id}
              onClick={() => setSelected(selected?.id === letter.id ? null : letter)}
              className="montessori-card p-3 text-center flex flex-col items-center gap-1 transition-all hover:scale-105"
              style={{
                background: selected?.id === letter.id ? `${letter.color}25` : "white",
                border: `2px solid ${selected?.id === letter.id ? letter.color : `${letter.color}40`}`,
              }}
            >
              <span
                className="text-3xl font-black"
                style={{ fontFamily: "'Cairo', sans-serif", color: letter.color }}
              >
                {letter.isolated}
              </span>
              <span className="text-[10px] font-bold text-gray-500">{letter.nameTranslit}</span>
            </button>
          ))}
        </div>

        {/* Letter detail */}
        {selected && (
          <div
            className="bg-white rounded-3xl shadow-lg p-8 animate-bounce-in"
            style={{ border: `2px solid ${selected.color}40` }}
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Big letter */}
              <div
                className="w-32 h-32 rounded-3xl flex items-center justify-center shrink-0"
                style={{ background: `${selected.color}20` }}
              >
                <span
                  className="text-7xl font-black"
                  style={{ fontFamily: "'Cairo', sans-serif", color: selected.color }}
                >
                  {selected.isolated}
                </span>
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                  <h2
                    className="text-3xl font-black text-[#2d2d2d]"
                    style={{ fontFamily: "'Cairo', sans-serif" }}
                  >
                    {selected.name}
                  </h2>
                  <span className="text-lg font-bold text-gray-400">{selected.nameTranslit}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: selected.color }}
                  >
                    /{selected.translit}/
                  </span>
                </div>

                {/* 4 forms */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Isolée", form: selected.isolated },
                    { label: "Initiale", form: selected.initial },
                    { label: "Médiane", form: selected.medial },
                    { label: "Finale", form: selected.final },
                  ].map(({ label, form }) => (
                    <div key={label} className="bg-gray-50 rounded-2xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p
                        className="text-2xl font-black"
                        style={{ fontFamily: "'Cairo', sans-serif", color: selected.color }}
                      >
                        {form}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Example word */}
                <div
                  className="inline-flex items-center gap-3 rounded-2xl px-5 py-3"
                  style={{ background: `${selected.color}15` }}
                >
                  <span className="text-2xl font-black text-[#2d2d2d]" style={{ fontFamily: "'Cairo', sans-serif" }}>
                    {selected.example}
                  </span>
                  <div className="text-sm">
                    <p className="font-bold text-[#2d2d2d]">{selected.exampleMeaning}</p>
                    <p className="text-gray-400 text-xs">{selected.exampleTranslit}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
