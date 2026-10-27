"use client";
import Image from "next/image";
import type { ArabicWord } from "@/data/arabicVocabulary";
import { WordArt, hasWordArt } from "@/components/student/WordArt";

/**
 * L'image d'un mot de vocabulaire, dans l'ordre : sa photo (`word.image`,
 * sous /vocab, libre de droits — crédits dans public/vocab/credits.json), son
 * dessin (WordArt), à défaut son pictogramme. Toujours dans un carré : les
 * réponses d'un exercice doivent se présenter de la même façon.
 */
export function VocabPicture({ word, sizes, className = "", priority = false }: {
  word: ArabicWord;
  /** Largeur affichée, pour que la photo soit servie à la bonne taille. */
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (word.image) {
    return (
      <span className={`relative block aspect-square w-full overflow-hidden ${className}`}>
        <Image src={word.image} alt="" fill sizes={sizes} priority={priority} draggable={false} className="object-cover" />
      </span>
    );
  }
  if (hasWordArt(word.id)) {
    return (
      <span className={`flex aspect-square w-full items-center justify-center bg-ms-canvas ${className}`}>
        <WordArt wordId={word.id} className="h-[82%] w-auto max-w-full" />
      </span>
    );
  }
  return (
    <span className={`flex aspect-square w-full items-center justify-center bg-ms-canvas ${className}`} aria-hidden="true">
      <span className="select-none text-[3.25rem] leading-none sm:text-[4.5rem]">{word.emoji}</span>
    </span>
  );
}
