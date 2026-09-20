/**
 * Mots-exemples du niveau avancé : pour chaque lettre, un mot où elle est au
 * début, un où elle est au milieu, un où elle est à la fin. La lettre étudiée
 * (avec ses voyelles) est entre crochets : c'est elle qui sera colorée.
 * La traduction sert de repère à l'enseignant ; elle n'est jamais projetée.
 *
 * Dans chaque mot, la lettre doit prendre le tracé de sa position : pas de
 * lettre « du milieu » ou « de la fin » juste après ا د ذ ر ز و, qui ne
 * s'attachent pas à la suivante (un test le vérifie).
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
    medial: { text: "غَ[زَ]ال", french: "gazelle", emoji: "🦌" },
    final: { text: "خُبْ[ز]", french: "pain", emoji: "🍞" },
  },
  12: {
    initial: { text: "[سَ]مَكَة", french: "poisson", emoji: "🐟" },
    medial: { text: "جِ[سْ]ر", french: "pont", emoji: "🌉" },
    final: { text: "شَمْ[س]", french: "soleil", emoji: "☀️" },
  },
  13: {
    initial: { text: "[شَ]مْس", french: "soleil", emoji: "☀️" },
    medial: { text: "عُ[شْ]ب", french: "herbe", emoji: "🌿" },
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
    final: { text: "أَنْ[ف]", french: "nez", emoji: "👃" },
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
    final: { text: "لَبَ[ن]", french: "lait", emoji: "🥛" },
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

/**
 * Mots supplémentaires réservés aux exercices : l'élève y retrouve la lettre
 * dans des mots qu'il n'a pas vus pendant la présentation.
 */
export const EXERCISE_WORDS: Record<number, Record<LetterPosition, LetterWord[]>> = {
  1: {
    initial: [{ text: "[أَ]سَد", french: "lion", emoji: "🦁" }, { text: "[أُ]ذُن", french: "oreille", emoji: "👂" }],
    medial: [{ text: "نَ[ا]ر", french: "feu", emoji: "🔥" }, { text: "تَ[ا]ج", french: "couronne", emoji: "👑" }],
    final: [{ text: "هَدَايَ[ا]", french: "cadeaux", emoji: "🎁" }, { text: "أَنَ[ا]", french: "moi", emoji: "🙋" }],
  },
  2: {
    initial: [{ text: "[بَ]اب", french: "porte", emoji: "🚪" }, { text: "[بُ]رْتُقَال", french: "orange", emoji: "🍊" }],
    medial: [{ text: "حَ[بْ]ل", french: "corde", emoji: "🪢" }, { text: "لَ[بَ]ن", french: "lait", emoji: "🥛" }],
    final: [{ text: "حَلِي[ب]", french: "lait", emoji: "🥛" }, { text: "عِنَ[ب]", french: "raisin", emoji: "🍇" }],
  },
  3: {
    initial: [{ text: "[تِ]مْسَاح", french: "crocodile", emoji: "🐊" }, { text: "[تَ]اج", french: "couronne", emoji: "👑" }],
    medial: [{ text: "مِفْ[تَ]اح", french: "clé", emoji: "🔑" }, { text: "بُسْ[تَ]ان", french: "jardin", emoji: "🏡" }],
    final: [{ text: "بِنْ[ت]", french: "fille", emoji: "👧" }, { text: "زَيْ[ت]", french: "huile", emoji: "🫒" }],
  },
  4: {
    initial: [{ text: "[ثَ]وْر", french: "taureau", emoji: "🐂" }, { text: "[ثَ]لْج", french: "neige", emoji: "❄️" }],
    medial: [{ text: "مُ[ثَ]لَّث", french: "triangle", emoji: "🔺" }],
    final: [{ text: "مُثَلَّ[ث]", french: "triangle", emoji: "🔺" }],
  },
  5: {
    initial: [{ text: "[جَ]زَر", french: "carottes", emoji: "🥕" }, { text: "[جُ]بْن", french: "fromage", emoji: "🧀" }],
    medial: [{ text: "نَ[جْ]م", french: "étoile", emoji: "⭐" }, { text: "فِنْ[جَ]ان", french: "tasse", emoji: "☕" }],
    final: [{ text: "بَنَفْسَ[ج]", french: "violette", emoji: "🪻" }, { text: "نَسِي[ج]", french: "tissu", emoji: "🧶" }],
  },
  6: {
    initial: [{ text: "[حَ]لِيب", french: "lait", emoji: "🥛" }, { text: "[حُ]وت", french: "baleine", emoji: "🐋" }],
    medial: [{ text: "نَ[حْ]لَة", french: "abeille", emoji: "🐝" }, { text: "لَ[حْ]م", french: "viande", emoji: "🥩" }],
    final: [{ text: "قَمْ[ح]", french: "blé", emoji: "🌾" }, { text: "مَسْبَ[ح]", french: "piscine", emoji: "🏊" }],
  },
  7: {
    initial: [{ text: "[خَ]رُوف", french: "mouton", emoji: "🐑" }, { text: "[خِ]يَار", french: "concombre", emoji: "🥒" }],
    medial: [{ text: "بُ[خَ]ار", french: "vapeur", emoji: "♨️" }, { text: "مِ[خَ]دَّة", french: "oreiller", emoji: "🛏️" }],
    final: [{ text: "مَطْبَ[خ]", french: "cuisine", emoji: "🍳" }, { text: "فَ[خّ]", french: "piège", emoji: "🪤" }],
  },
  8: {
    initial: [{ text: "[دِ]يك", french: "coq", emoji: "🐓" }, { text: "[دَ]جَاجَة", french: "poule", emoji: "🐔" }],
    medial: [{ text: "حَ[دِ]يقَة", french: "jardin", emoji: "🌳" }, { text: "هُ[دْ]هُد", french: "huppe", emoji: "🐦" }],
    final: [{ text: "يَ[د]", french: "main", emoji: "✋" }, { text: "أَسَ[د]", french: "lion", emoji: "🦁" }],
  },
  9: {
    initial: [{ text: "[ذُ]بَابَة", french: "mouche", emoji: "🪰" }, { text: "[ذَ]هَب", french: "or", emoji: "🥇" }],
    medial: [{ text: "بِ[ذْ]رَة", french: "graine", emoji: "🌱" }, { text: "جِ[ذْ]ع", french: "tronc", emoji: "🪵" }],
    final: [{ text: "تِلْمِي[ذ]", french: "élève", emoji: "🧑‍🎓" }, { text: "لَذِي[ذ]", french: "délicieux", emoji: "😋" }],
  },
  10: {
    initial: [{ text: "[رَ]جُل", french: "homme", emoji: "👨" }, { text: "[رِ]جْل", french: "jambe", emoji: "🦵" }],
    medial: [{ text: "كُ[رَ]ة", french: "ballon", emoji: "⚽" }, { text: "مِ[رْ]آة", french: "miroir", emoji: "🪞" }],
    final: [{ text: "بَحْ[ر]", french: "mer", emoji: "🌊" }, { text: "نَمِ[ر]", french: "tigre", emoji: "🐅" }],
  },
  11: {
    initial: [{ text: "[زَ]هْرَة", french: "fleur", emoji: "🌸" }, { text: "[زَ]يْتُون", french: "olives", emoji: "🫒" }],
    medial: [{ text: "جَ[زَ]ر", french: "carottes", emoji: "🥕" }, { text: "مَنْ[زِ]ل", french: "maison", emoji: "🏡" }],
    final: [{ text: "كَنْ[ز]", french: "trésor", emoji: "💎" }, { text: "عَنْ[ز]", french: "chèvre", emoji: "🐐" }],
  },
  12: {
    initial: [{ text: "[سَ]يَّارَة", french: "voiture", emoji: "🚗" }, { text: "[سُ]لَحْفَاة", french: "tortue", emoji: "🐢" }],
    medial: [{ text: "مِ[سْ]طَرَة", french: "règle", emoji: "📏" }, { text: "عَ[سَ]ل", french: "miel", emoji: "🍯" }],
    final: [{ text: "خَمْ[س]", french: "cinq", emoji: "5️⃣" }, { text: "مَلْبَ[س]", french: "vêtement", emoji: "👕" }],
  },
  13: {
    initial: [{ text: "[شَ]جَرَة", french: "arbre", emoji: "🌳" }, { text: "[شُ]بَّاك", french: "fenêtre", emoji: "🪟" }],
    medial: [{ text: "مِ[شْ]مِش", french: "abricot", emoji: "🍑" }, { text: "مِ[شْ]ط", french: "peigne", emoji: "🪮" }],
    final: [{ text: "مِشْمِ[ش]", french: "abricot", emoji: "🍑" }, { text: "رِي[ش]", french: "plumes", emoji: "🪶" }],
  },
  14: {
    initial: [{ text: "[صَ]ابُون", french: "savon", emoji: "🧼" }, { text: "[صُ]نْدُوق", french: "boîte", emoji: "📦" }],
    medial: [{ text: "بَ[صَ]ل", french: "oignon", emoji: "🧅" }, { text: "حِ[صَ]ان", french: "cheval", emoji: "🐴" }],
    final: [{ text: "قَمِي[ص]", french: "chemise", emoji: "👔" }, { text: "لِ[صّ]", french: "voleur", emoji: "🥷" }],
  },
  15: {
    initial: [{ text: "[ضَ]وْء", french: "lumière", emoji: "💡" }, { text: "[ضِ]رْس", french: "dent", emoji: "🦷" }],
    medial: [{ text: "بَيْ[ضَ]ة", french: "œuf", emoji: "🥚" }, { text: "أَخْ[ضَ]ر", french: "vert", emoji: "🟢" }],
    final: [{ text: "أَبْيَ[ض]", french: "blanc", emoji: "⚪" }, { text: "مَرِي[ض]", french: "malade", emoji: "🤒" }],
  },
  16: {
    initial: [{ text: "[طِ]فْل", french: "enfant", emoji: "👶" }, { text: "[طَ]بْل", french: "tambour", emoji: "🥁" }],
    medial: [{ text: "بَ[طَّ]ة", french: "canard", emoji: "🦆" }, { text: "مَ[طَ]ر", french: "pluie", emoji: "🌧️" }],
    final: [{ text: "خَيْ[ط]", french: "fil", emoji: "🧵" }, { text: "قِ[طّ]", french: "chat", emoji: "🐈" }],
  },
  17: {
    initial: [{ text: "[ظَ]بْي", french: "gazelle", emoji: "🦌" }, { text: "[ظِ]لّ", french: "ombre", emoji: "👤" }],
    medial: [{ text: "مِ[ظَ]لَّة", french: "parapluie", emoji: "☂️" }, { text: "عَ[ظْ]م", french: "os", emoji: "🦴" }],
    final: [{ text: "حِفْ[ظ]", french: "mémorisation", emoji: "🧠" }],
  },
  18: {
    initial: [{ text: "[عِ]نَب", french: "raisin", emoji: "🍇" }, { text: "[عَ]سَل", french: "miel", emoji: "🍯" }],
    medial: [{ text: "ثَ[عْ]لَب", french: "renard", emoji: "🦊" }, { text: "مِلْ[عَ]قَة", french: "cuillère", emoji: "🥄" }],
    final: [{ text: "شَمْ[ع]", french: "bougies", emoji: "🕯️" }, { text: "مَصْنَ[ع]", french: "usine", emoji: "🏭" }],
  },
  19: {
    initial: [{ text: "[غَ]زَال", french: "gazelle", emoji: "🦌" }, { text: "[غَ]يْمَة", french: "nuage", emoji: "☁️" }],
    medial: [{ text: "صَ[غِ]ير", french: "petit", emoji: "🤏" }, { text: "لُ[غَ]ة", french: "langue", emoji: "🗣️" }],
    final: [{ text: "مَبْلَ[غ]", french: "somme d'argent", emoji: "💰" }],
  },
  20: {
    initial: [{ text: "[فَ]رَاشَة", french: "papillon", emoji: "🦋" }, { text: "[فَ]أْر", french: "souris", emoji: "🐭" }],
    medial: [{ text: "مِ[فْ]تَاح", french: "clé", emoji: "🔑" }, { text: "عُصْ[فُ]ور", french: "oiseau", emoji: "🐦" }],
    final: [{ text: "سَيْ[ف]", french: "épée", emoji: "🗡️" }, { text: "صَيْ[ف]", french: "été", emoji: "🏖️" }],
  },
  21: {
    initial: [{ text: "[قِ]رْد", french: "singe", emoji: "🐒" }, { text: "[قَ]مَر", french: "lune", emoji: "🌙" }],
    medial: [{ text: "صَ[قْ]ر", french: "faucon", emoji: "🦅" }, { text: "مِ[قَ]صّ", french: "ciseaux", emoji: "✂️" }],
    final: [{ text: "إِبْرِي[ق]", french: "théière", emoji: "🫖" }, { text: "صَدِي[ق]", french: "ami", emoji: "🤝" }],
  },
  22: {
    initial: [{ text: "[كِ]تَاب", french: "livre", emoji: "📖" }, { text: "[كُ]رَة", french: "ballon", emoji: "⚽" }],
    medial: [{ text: "سُ[كَّ]ر", french: "sucre", emoji: "🍬" }, { text: "مَ[كْ]تَب", french: "bureau", emoji: "🖥️" }],
    final: [{ text: "سَمَ[ك]", french: "poissons", emoji: "🐟" }, { text: "مَلِ[ك]", french: "roi", emoji: "🤴" }],
  },
  23: {
    initial: [{ text: "[لَ]بَن", french: "lait", emoji: "🥛" }, { text: "[لَ]حْم", french: "viande", emoji: "🥩" }],
    medial: [{ text: "كَ[لْ]ب", french: "chien", emoji: "🐕" }, { text: "ثَ[لْ]ج", french: "neige", emoji: "❄️" }],
    final: [{ text: "فِي[ل]", french: "éléphant", emoji: "🐘" }, { text: "جَبَ[ل]", french: "montagne", emoji: "⛰️" }],
  },
  24: {
    initial: [{ text: "[مِ]فْتَاح", french: "clé", emoji: "🔑" }, { text: "[مَ]طَر", french: "pluie", emoji: "🌧️" }],
    medial: [{ text: "شَ[مْ]س", french: "soleil", emoji: "☀️" }, { text: "جَ[مَ]ل", french: "chameau", emoji: "🐫" }],
    final: [{ text: "قَلَ[م]", french: "crayon", emoji: "✏️" }, { text: "فَ[م]", french: "bouche", emoji: "👄" }],
  },
  25: {
    initial: [{ text: "[نَ]مْلَة", french: "fourmi", emoji: "🐜" }, { text: "[نَ]جْم", french: "étoile", emoji: "⭐" }],
    medial: [{ text: "قُ[نْ]فُذ", french: "hérisson", emoji: "🦔" }, { text: "بِ[نْ]ت", french: "fille", emoji: "👧" }],
    final: [{ text: "عَيْ[ن]", french: "œil", emoji: "👁️" }, { text: "جُبْ[ن]", french: "fromage", emoji: "🧀" }],
  },
  26: {
    initial: [{ text: "[هَ]دِيَّة", french: "cadeau", emoji: "🎁" }, { text: "[هُ]دْهُد", french: "huppe", emoji: "🐦" }],
    medial: [{ text: "سَ[هْ]م", french: "flèche", emoji: "🏹" }, { text: "فَ[هْ]د", french: "guépard", emoji: "🐆" }],
    final: [{ text: "تَنْبِي[ه]", french: "alerte", emoji: "⚠️" }, { text: "فَوَاكِ[ه]", french: "fruits", emoji: "🍓" }],
  },
  27: {
    initial: [{ text: "[وَ]لَد", french: "garçon", emoji: "👦" }, { text: "[وَ]جْه", french: "visage", emoji: "🙂" }],
    medial: [{ text: "لَ[وْ]ن", french: "couleur", emoji: "🎨" }, { text: "ثَ[وْ]ر", french: "taureau", emoji: "🐂" }],
    final: [{ text: "حُلْ[و]", french: "sucré", emoji: "🍬" }, { text: "جَ[وّ]", french: "air", emoji: "🌬️" }],
  },
  28: {
    initial: [{ text: "[يَ]مَامَة", french: "colombe", emoji: "🕊️" }, { text: "[يَ]اسَمِين", french: "jasmin", emoji: "🌼" }],
    medial: [{ text: "طَ[يْ]ر", french: "oiseau", emoji: "🐦" }, { text: "لَ[يْ]ل", french: "nuit", emoji: "🌃" }],
    final: [{ text: "ظَبْ[ي]", french: "gazelle", emoji: "🦌" }, { text: "مَشْ[ي]", french: "marche", emoji: "🚶" }],
  },
};

/** Mots d'exercice pour une lettre à une position : le mot présenté, puis les supplémentaires. */
export function exerciseWords(letterId: number, position: LetterPosition): LetterWord[] {
  return [LETTER_WORDS[letterId][position], ...(EXERCISE_WORDS[letterId]?.[position] ?? [])];
}
