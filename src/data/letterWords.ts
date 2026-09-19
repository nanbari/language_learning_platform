/**
 * Mots-exemples du niveau avancé : pour chaque lettre, un mot où elle est au
 * début, un où elle est au milieu, un où elle est à la fin. La lettre étudiée
 * (avec ses voyelles) est entre crochets : c'est elle qui sera colorée.
 * La traduction sert de repère à l'enseignant ; elle n'est jamais projetée.
 */
export interface LetterWord {
  /** Mot vocalisé, la lettre étudiée entre crochets : « [بَ]طَّة ». */
  text: string;
  french: string;
  emoji: string;
}

export type LetterPosition = "initial" | "medial" | "final";

export const LETTER_POSITIONS: LetterPosition[] = ["initial", "medial", "final"];

/** Indexé par `ArabicLetter.id`. */
export const LETTER_WORDS: Record<number, Record<LetterPosition, LetterWord>> = {
  1: {
    initial: { text: "[أَ]رْنَب", french: "lapin", emoji: "🐰" },
    medial: { text: "بَ[ا]ب", french: "porte", emoji: "🚪" },
    final: { text: "عَصَ[ا]", french: "bâton", emoji: "🪵" },
  },
  2: {
    initial: { text: "[بَ]طَّة", french: "canard", emoji: "🦆" },
    medial: { text: "جَ[بَ]ل", french: "montagne", emoji: "⛰️" },
    final: { text: "كَلْ[ب]", french: "chien", emoji: "🐕" },
  },
  3: {
    initial: { text: "[تُ]فَّاحَة", french: "pomme", emoji: "🍎" },
    medial: { text: "كِ[تَ]اب", french: "livre", emoji: "📖" },
    final: { text: "بَيْ[ت]", french: "maison", emoji: "🏠" },
  },
  4: {
    initial: { text: "[ثَ]عْلَب", french: "renard", emoji: "🦊" },
    medial: { text: "كُمَّ[ثْ]رَى", french: "poire", emoji: "🍐" },
    final: { text: "لَيْ[ث]", french: "lion", emoji: "🦁" },
  },
  5: {
    initial: { text: "[جَ]مَل", french: "chameau", emoji: "🐫" },
    medial: { text: "شَ[جَ]رَة", french: "arbre", emoji: "🌳" },
    final: { text: "ثَلْ[ج]", french: "neige", emoji: "❄️" },
  },
  6: {
    initial: { text: "[حِ]صَان", french: "cheval", emoji: "🐴" },
    medial: { text: "بَ[حْ]ر", french: "mer", emoji: "🌊" },
    final: { text: "مِلْ[ح]", french: "sel", emoji: "🧂" },
  },
  7: {
    initial: { text: "[خُ]بْز", french: "pain", emoji: "🍞" },
    medial: { text: "نَ[خْ]لَة", french: "palmier", emoji: "🌴" },
    final: { text: "بَطِّي[خ]", french: "pastèque", emoji: "🍉" },
  },
  8: {
    initial: { text: "[دُ]بّ", french: "ours", emoji: "🐻" },
    medial: { text: "مَ[دْ]رَسَة", french: "école", emoji: "🏫" },
    final: { text: "وَلَ[د]", french: "garçon", emoji: "👦" },
  },
  9: {
    initial: { text: "[ذِ]ئْب", french: "loup", emoji: "🐺" },
    medial: { text: "حِ[ذَ]اء", french: "chaussure", emoji: "👟" },
    final: { text: "قُنْفُ[ذ]", french: "hérisson", emoji: "🦔" },
  },
  10: {
    initial: { text: "[رِ]يشَة", french: "plume", emoji: "🪶" },
    medial: { text: "جَ[رَ]س", french: "cloche", emoji: "🔔" },
    final: { text: "قَمَ[ر]", french: "lune", emoji: "🌙" },
  },
  11: {
    initial: { text: "[زَ]رَافَة", french: "girafe", emoji: "🦒" },
    medial: { text: "مَوْ[زَ]ة", french: "banane", emoji: "🍌" },
    final: { text: "خُبْ[ز]", french: "pain", emoji: "🍞" },
  },
  12: {
    initial: { text: "[سَ]مَكَة", french: "poisson", emoji: "🐟" },
    medial: { text: "جِ[سْ]ر", french: "pont", emoji: "🌉" },
    final: { text: "شَمْ[س]", french: "soleil", emoji: "☀️" },
  },
  13: {
    initial: { text: "[شَ]مْس", french: "soleil", emoji: "☀️" },
    medial: { text: "فَرَا[شَ]ة", french: "papillon", emoji: "🦋" },
    final: { text: "عُ[شّ]", french: "nid", emoji: "🪺" },
  },
  14: {
    initial: { text: "[صَ]قْر", french: "faucon", emoji: "🦅" },
    medial: { text: "عَ[صِ]ير", french: "jus", emoji: "🧃" },
    final: { text: "مِقَ[صّ]", french: "ciseaux", emoji: "✂️" },
  },
  15: {
    initial: { text: "[ضِ]فْدَع", french: "grenouille", emoji: "🐸" },
    medial: { text: "خُ[ضَ]ار", french: "légumes", emoji: "🥦" },
    final: { text: "بَيْ[ض]", french: "œufs", emoji: "🥚" },
  },
  16: {
    initial: { text: "[طَ]ائِرَة", french: "avion", emoji: "✈️" },
    medial: { text: "قِ[طَّ]ة", french: "chat", emoji: "🐱" },
    final: { text: "مِشْ[ط]", french: "peigne", emoji: "🪮" },
  },
  17: {
    initial: { text: "[ظَ]رْف", french: "enveloppe", emoji: "✉️" },
    medial: { text: "نَ[ظَّ]ارَة", french: "lunettes", emoji: "👓" },
    final: { text: "حَ[ظّ]", french: "chance", emoji: "🍀" },
  },
  18: {
    initial: { text: "[عَ]يْن", french: "œil", emoji: "👁️" },
    medial: { text: "لُ[عْ]بَة", french: "jouet", emoji: "🧸" },
    final: { text: "إِصْبَ[ع]", french: "doigt", emoji: "☝️" },
  },
  19: {
    initial: { text: "[غُ]رَاب", french: "corbeau", emoji: "🐦‍⬛" },
    medial: { text: "بَبَّ[غَ]اء", french: "perroquet", emoji: "🦜" },
    final: { text: "صَمْ[غ]", french: "colle", emoji: "🧴" },
  },
  20: {
    initial: { text: "[فِ]يل", french: "éléphant", emoji: "🐘" },
    medial: { text: "تُ[فَّ]احَة", french: "pomme", emoji: "🍎" },
    final: { text: "خَرُو[ف]", french: "mouton", emoji: "🐑" },
  },
  21: {
    initial: { text: "[قَ]لَم", french: "crayon", emoji: "✏️" },
    medial: { text: "بَ[قَ]رَة", french: "vache", emoji: "🐄" },
    final: { text: "طَبَ[ق]", french: "assiette", emoji: "🍽️" },
  },
  22: {
    initial: { text: "[كَ]لْب", french: "chien", emoji: "🐕" },
    medial: { text: "سَمَ[كَ]ة", french: "poisson", emoji: "🐟" },
    final: { text: "دِي[ك]", french: "coq", emoji: "🐓" },
  },
  23: {
    initial: { text: "[لَ]يْمُون", french: "citron", emoji: "🍋" },
    medial: { text: "قَ[لَ]م", french: "crayon", emoji: "✏️" },
    final: { text: "جَمَ[ل]", french: "chameau", emoji: "🐫" },
  },
  24: {
    initial: { text: "[مَ]وْز", french: "bananes", emoji: "🍌" },
    medial: { text: "نَ[مْ]لَة", french: "fourmi", emoji: "🐜" },
    final: { text: "نَجْ[م]", french: "étoile", emoji: "⭐" },
  },
  25: {
    initial: { text: "[نَ]حْلَة", french: "abeille", emoji: "🐝" },
    medial: { text: "عِ[نَ]ب", french: "raisin", emoji: "🍇" },
    final: { text: "حِصَا[ن]", french: "cheval", emoji: "🐴" },
  },
  26: {
    initial: { text: "[هِ]لَال", french: "croissant de lune", emoji: "🌙" },
    medial: { text: "نَ[هْ]ر", french: "rivière", emoji: "🏞️" },
    final: { text: "وَجْ[ه]", french: "visage", emoji: "🙂" },
  },
  27: {
    initial: { text: "[وَ]رْدَة", french: "rose", emoji: "🌹" },
    medial: { text: "مَ[وْ]ز", french: "bananes", emoji: "🍌" },
    final: { text: "دَلْ[و]", french: "seau", emoji: "🪣" },
  },
  28: {
    initial: { text: "[يَ]د", french: "main", emoji: "✋" },
    medial: { text: "بَ[يْ]ت", french: "maison", emoji: "🏠" },
    final: { text: "كُرْسِ[يّ]", french: "chaise", emoji: "🪑" },
  },
};
