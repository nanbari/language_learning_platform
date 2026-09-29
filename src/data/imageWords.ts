/**
 * Mots arabes des images de leçons connues, par URL publique. Sert à formuler,
 * pour l'enseignant, la question d'un QCM dont il n'a pas écrit la question
 * (« أَيْنَ التُّفَّاحَةُ؟ » quand la bonne réponse est l'image de la pomme).
 * Le mot est donné avec l'article, au nominatif, prêt à être lu.
 */

const MEDIA = "https://pub-b05b6ac8db824a2d8799212649378e6c.r2.dev/media/2026/";

const FRUITS = {
  fruits: "الْفَوَاكِهُ",
  pomme: "التُّفَّاحَةُ",
  orange: "الْبُرْتُقَالَةُ",
  banane: "الْمَوْزَةُ",
  fraise: "الْفَرَاوِلَةُ",
  raisin: "الْعِنَبُ",
};

/** Leçon « Les fruits » : les cartes, puis les images des réponses de ses QCM. */
const FRUIT_IMAGES: Record<string, keyof typeof FRUITS> = {
  "bf903aae-5e56-480e-b709-c9ac102f5a7d-media.jpg": "fruits",
  "5e36a85a-5d87-49d0-807e-620255d1093e-media.jpg": "pomme",
  "693ac866-59a7-42d9-9668-60741d6a9dec-media.bin": "orange",
  "e3b9c0ae-127f-4dac-b1cd-e4b1189b8263-media.jpg": "banane",
  "a644fa27-213d-4d0b-9685-234cfd71e57e-media.jpg": "fraise",
  "bec8ea40-3d79-4f38-a988-583ff46f922b-media.jpg": "raisin",
  "d41c8717-828f-4b8a-88ac-2bb5cc6d9660-media.jpg": "fruits",
  "1bb1deab-3733-4812-bd65-23a60efc4fff-media.jpg": "pomme",
  "b66f0c70-c411-405a-b59e-70d0ad0fb2a0-media.jpg": "orange",
  "5b6c3c3e-e98d-44ec-970a-3e11987e1dfd-media.jpg": "banane",
  "a5f47ddf-a57c-4601-83d9-6962f8cf0520-media.jpg": "banane",
  "ce67fee1-9275-409d-8491-0da050c932bf-media.jpg": "banane",
  "f586943f-b048-4fe1-94d9-852f18ec731d-media.jpg": "fraise",
  "1945fc0b-7a71-49aa-9610-b70422c3a0b5-media.jpg": "fraise",
  "c3be1644-6a5c-421d-bc3e-e6916fdd2c96-media.jpg": "fraise",
  "3da26480-b3b3-4a9e-8ac2-fe4458a6488e-media.jpg": "raisin",
  "e5ad1752-89c3-499f-952d-1ecaad83af1c-media.jpg": "raisin",
  "9865056a-8dae-4c0c-9cd9-60f2f831dfa0-media.jpg": "raisin",
};

export const IMAGE_WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(FRUIT_IMAGES).map(([file, fruit]) => [`${MEDIA}${file}`, FRUITS[fruit]]),
);

/** Mot arabe d'une image de leçon, si elle est connue. */
export function imageWord(imageUrl: string | undefined): string | undefined {
  return imageUrl ? IMAGE_WORDS[imageUrl] : undefined;
}
