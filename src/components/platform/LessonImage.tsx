"use client";
import Image, { type ImageProps } from "next/image";

/**
 * Image d'une leçon (couverture, réponse de quiz, diapo, mot du cours en
 * direct). Les photos de l'enseignant sont stockées en pleine taille sur R2
 * (souvent 2 à 3 Mo) : next/image les sert redimensionnées à la largeur
 * réellement affichée (`sizes`), en WebP/AVIF, avec un cache long. Dans
 * l'éditeur, une image pas encore enregistrée est une data URL : elle passe
 * telle quelle, sans optimisation.
 */
export function LessonImage({ src, alt, sizes, className, priority = false, fill = true, width, height, draggable = false }: {
  src: string;
  alt: string;
  /** Largeur affichée, en unités CSS (ex. `(min-width: 1024px) 20rem, 45vw`). Obligatoire pour que le navigateur choisisse la bonne taille. */
  sizes: string;
  className?: string;
  /** Image du premier écran (LCP) : préchargée. */
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  draggable?: boolean;
}) {
  const local = src.startsWith("data:") || src.startsWith("blob:");
  const common: Partial<ImageProps> = {
    alt, sizes, className, draggable, priority,
    unoptimized: local,
    loading: priority ? undefined : "lazy",
    decoding: "async",
  };
  if (fill) return <Image src={src} fill {...common} alt={alt} />;
  return <Image src={src} width={width ?? 800} height={height ?? 800} {...common} alt={alt} />;
}
