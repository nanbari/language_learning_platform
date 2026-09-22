/**
 * Animations des séances en direct, rendues par le projet `animations/`
 * (Remotion) en MP4 dans public/animations. Chaque entrée relie une image
 * d'une leçon d'enseignant, par son URL publique, aux clips qui la mettent en
 * scène : après la carte de ce mot, la séance les joue dans l'ordre.
 */

/** Une animation : le fichier vidéo et, pour l'enseignant, ce qu'elle montre. */
export interface Clip {
  src: string;
  /** Ce que raconte le clip, pour la barre de commandes de l'enseignant (jamais montré aux élèves). */
  caption: string;
}

const FRUIT_MEDIA = "https://pub-b05b6ac8db824a2d8799212649378e6c.r2.dev/media/2026/";

/** Le geste filmé pour un fruit : `pomme-couper` → /animations/fruits/pomme-couper.mp4. */
function fruitClip(id: string, caption: string): Clip[] {
  return [{ src: `/animations/fruits/${id}.mp4`, caption }];
}

/**
 * Images de leçons connues, et leurs clips. L'ordre des entrées est celui de
 * la séance : après la première image de la leçon, les mots animés sont
 * présentés dans cet ordre, avant les autres.
 */
export const IMAGE_CLIPS: Record<string, Clip[]> = {
  // Leçon « Les fruits » : un seul geste par fruit — pomme, orange, banane, fraise, raisin.
  [`${FRUIT_MEDIA}5e36a85a-5d87-49d0-807e-620255d1093e-media.jpg`]: fruitClip("pomme-couper", "On coupe la pomme"),
  [`${FRUIT_MEDIA}693ac866-59a7-42d9-9668-60741d6a9dec-media.bin`]: fruitClip("orange-jus", "On presse l'orange : du jus !"),
  [`${FRUIT_MEDIA}e3b9c0ae-127f-4dac-b1cd-e4b1189b8263-media.jpg`]: fruitClip("banane-eplucher", "On épluche la banane"),
  [`${FRUIT_MEDIA}a644fa27-213d-4d0b-9685-234cfd71e57e-media.jpg`]: fruitClip("fraise-manger", "On mange la fraise"),
  [`${FRUIT_MEDIA}bec8ea40-3d79-4f38-a988-583ff46f922b-media.jpg`]: fruitClip("raisin-laver", "On lave le raisin"),
};

/** Clips attachés à une image de leçon, s'il y en a. */
export function clipsFor(imageUrl: string | undefined): Clip[] {
  return imageUrl ? IMAGE_CLIPS[imageUrl] ?? [] : [];
}

/** Rang d'un mot animé dans la séance (0 pour le premier), ou rien s'il n'est pas animé. */
export function clipRank(imageUrl: string | undefined): number | undefined {
  const rank = imageUrl ? Object.keys(IMAGE_CLIPS).indexOf(imageUrl) : -1;
  return rank >= 0 ? rank : undefined;
}
