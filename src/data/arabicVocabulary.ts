export interface ArabicWord {
  id: string;
  arabic: string;        // الكلمة بالعربية (avec harakat)
  translit: string;      // translittération
  french: string;        // traduction française
  emoji: string;
  audio?: string;        // path to audio file
}

export interface VocabTheme {
  id: string;
  nameArabic: string;
  nameFrench: string;
  emoji: string;
  color: string;
  bg: string;
  words: ArabicWord[];
}

export const VOCAB_THEMES: VocabTheme[] = [
  {
    id: "animals",
    nameArabic: "الحَيَوَانَات",
    nameFrench: "Les animaux",
    emoji: "🐾",
    color: "#f9a875",
    bg: "#fff5ee",
    words: [
      { id: "a1", arabic: "أَسَد", translit: "asad", french: "lion", emoji: "🦁" },
      { id: "a2", arabic: "فِيل", translit: "fîl", french: "éléphant", emoji: "🐘" },
      { id: "a3", arabic: "قِرْد", translit: "qird", french: "singe", emoji: "🐒" },
      { id: "a4", arabic: "زَرَافَة", translit: "zarâfa", french: "girafe", emoji: "🦒" },
      { id: "a5", arabic: "دُبّ", translit: "dubb", french: "ours", emoji: "🐻" },
      { id: "a6", arabic: "نَمِر", translit: "namir", french: "tigre", emoji: "🐯" },
      { id: "a7", arabic: "حِصَان", translit: "ḥiṣân", french: "cheval", emoji: "🐴" },
      { id: "a8", arabic: "بَقَرَة", translit: "baqara", french: "vache", emoji: "🐄" },
      { id: "a9", arabic: "كَلْب", translit: "kalb", french: "chien", emoji: "🐕" },
      { id: "a10", arabic: "هِرَّة", translit: "hirra", french: "chat", emoji: "🐱" },
      { id: "a11", arabic: "أَرْنَب", translit: "arnab", french: "lapin", emoji: "🐰" },
      { id: "a12", arabic: "سَمَكَة", translit: "samaka", french: "poisson", emoji: "🐟" },
    ],
  },
  {
    id: "colors",
    nameArabic: "الأَلْوَان",
    nameFrench: "Les couleurs",
    emoji: "🎨",
    color: "#c9b1e8",
    bg: "#f8f3ff",
    words: [
      { id: "c1", arabic: "أَحْمَر", translit: "aḥmar", french: "rouge", emoji: "🔴" },
      { id: "c2", arabic: "أَزْرَق", translit: "azraq", french: "bleu", emoji: "🔵" },
      { id: "c3", arabic: "أَخْضَر", translit: "akhḍar", french: "vert", emoji: "🟢" },
      { id: "c4", arabic: "أَصْفَر", translit: "aṣfar", french: "jaune", emoji: "🟡" },
      { id: "c5", arabic: "أَبْيَض", translit: "abyaḍ", french: "blanc", emoji: "⚪" },
      { id: "c6", arabic: "أَسْوَد", translit: "aswad", french: "noir", emoji: "⚫" },
      { id: "c7", arabic: "بُرْتُقَالِي", translit: "burtuqâlî", french: "orange", emoji: "🟠" },
      { id: "c8", arabic: "وَرْدِي", translit: "wardî", french: "rose", emoji: "🩷" },
      { id: "c9", arabic: "بَنَفْسَجِي", translit: "banafsajî", french: "violet", emoji: "🟣" },
      { id: "c10", arabic: "بُنِّي", translit: "bunnî", french: "marron", emoji: "🟤" },
    ],
  },
  {
    id: "numbers",
    nameArabic: "الأَرْقَام",
    nameFrench: "Les chiffres",
    emoji: "🔢",
    color: "#74c2e8",
    bg: "#f0f8ff",
    words: [
      { id: "n1", arabic: "وَاحِد", translit: "wâḥid", french: "un (1)", emoji: "1️⃣" },
      { id: "n2", arabic: "اِثْنَان", translit: "ithnân", french: "deux (2)", emoji: "2️⃣" },
      { id: "n3", arabic: "ثَلَاثَة", translit: "thalâtha", french: "trois (3)", emoji: "3️⃣" },
      { id: "n4", arabic: "أَرْبَعَة", translit: "arba'a", french: "quatre (4)", emoji: "4️⃣" },
      { id: "n5", arabic: "خَمْسَة", translit: "khamsa", french: "cinq (5)", emoji: "5️⃣" },
      { id: "n6", arabic: "سِتَّة", translit: "sitta", french: "six (6)", emoji: "6️⃣" },
      { id: "n7", arabic: "سَبْعَة", translit: "sab'a", french: "sept (7)", emoji: "7️⃣" },
      { id: "n8", arabic: "ثَمَانِيَة", translit: "thamâniya", french: "huit (8)", emoji: "8️⃣" },
      { id: "n9", arabic: "تِسْعَة", translit: "tis'a", french: "neuf (9)", emoji: "9️⃣" },
      { id: "n10", arabic: "عَشَرَة", translit: "'achara", french: "dix (10)", emoji: "🔟" },
    ],
  },
  {
    id: "family",
    nameArabic: "العَائِلَة",
    nameFrench: "La famille",
    emoji: "👨‍👩‍👧‍👦",
    color: "#ff8fa3",
    bg: "#fff0f3",
    words: [
      { id: "f1", arabic: "أَبّ", translit: "abb", french: "père", emoji: "👨" },
      { id: "f2", arabic: "أُمّ", translit: "umm", french: "mère", emoji: "👩" },
      { id: "f3", arabic: "أَخ", translit: "akh", french: "frère", emoji: "👦" },
      { id: "f4", arabic: "أُخْت", translit: "ukht", french: "sœur", emoji: "👧" },
      { id: "f5", arabic: "جَدّ", translit: "jadd", french: "grand-père", emoji: "👴" },
      { id: "f6", arabic: "جَدَّة", translit: "jadda", french: "grand-mère", emoji: "👵" },
      { id: "f7", arabic: "عَمّ", translit: "'amm", french: "oncle (paternel)", emoji: "🧔" },
      { id: "f8", arabic: "عَمَّة", translit: "'amma", french: "tante (paternelle)", emoji: "👩" },
      { id: "f9", arabic: "اِبْن", translit: "ibn", french: "fils", emoji: "🧒" },
      { id: "f10", arabic: "بِنْت", translit: "bint", french: "fille", emoji: "👧" },
    ],
  },
  {
    id: "body",
    nameArabic: "أَعْضَاء الجِسْم",
    nameFrench: "Le corps",
    emoji: "🫀",
    color: "#95d5b2",
    bg: "#f0faf5",
    words: [
      { id: "b1", arabic: "رَأْس", translit: "ra's", french: "tête", emoji: "🗣️" },
      { id: "b2", arabic: "عَيْن", translit: "'ayn", french: "œil", emoji: "👁️" },
      { id: "b3", arabic: "أَنْف", translit: "anf", french: "nez", emoji: "👃" },
      { id: "b4", arabic: "فَم", translit: "fam", french: "bouche", emoji: "👄" },
      { id: "b5", arabic: "أُذُن", translit: "udhun", french: "oreille", emoji: "👂" },
      { id: "b6", arabic: "يَد", translit: "yad", french: "main", emoji: "✋" },
      { id: "b7", arabic: "رِجْل", translit: "rijl", french: "pied / jambe", emoji: "🦵" },
      { id: "b8", arabic: "قَلْب", translit: "qalb", french: "cœur", emoji: "❤️" },
      { id: "b9", arabic: "شَعْر", translit: "sha'r", french: "cheveux", emoji: "💇" },
      { id: "b10", arabic: "أَسْنَان", translit: "asnân", french: "dents", emoji: "🦷" },
    ],
  },
  {
    id: "food",
    nameArabic: "الطَّعَام",
    nameFrench: "La nourriture",
    emoji: "🍎",
    color: "#ffd166",
    bg: "#fffbee",
    words: [
      { id: "fo1", arabic: "تُفَّاحَة", translit: "tuffâḥa", french: "pomme", emoji: "🍎" },
      { id: "fo2", arabic: "مَوْز", translit: "mawz", french: "banane", emoji: "🍌" },
      { id: "fo3", arabic: "خُبْز", translit: "khubz", french: "pain", emoji: "🍞" },
      { id: "fo4", arabic: "حَلِيب", translit: "ḥalîb", french: "lait", emoji: "🥛" },
      { id: "fo5", arabic: "بَيْضَة", translit: "bayḍa", french: "œuf", emoji: "🥚" },
      { id: "fo6", arabic: "لَحْم", translit: "laḥm", french: "viande", emoji: "🥩" },
      { id: "fo7", arabic: "سَمَك", translit: "samak", french: "poisson", emoji: "🐟" },
      { id: "fo8", arabic: "أَرُزّ", translit: "aruzz", french: "riz", emoji: "🍚" },
      { id: "fo9", arabic: "مَاء", translit: "mâ'", french: "eau", emoji: "💧" },
      { id: "fo10", arabic: "عَسَل", translit: "'asal", french: "miel", emoji: "🍯" },
      { id: "fo11", arabic: "جَزَر", translit: "jazar", french: "carotte", emoji: "🥕" },
      { id: "fo12", arabic: "لَيْمُون", translit: "laymûn", french: "citron", emoji: "🍋" },
    ],
  },
  {
    id: "nature",
    nameArabic: "الطَّبِيعَة",
    nameFrench: "La nature",
    emoji: "🌿",
    color: "#95d5b2",
    bg: "#f0faf5",
    words: [
      { id: "na1", arabic: "شَمْس", translit: "chams", french: "soleil", emoji: "☀️" },
      { id: "na2", arabic: "قَمَر", translit: "qamar", french: "lune", emoji: "🌙" },
      { id: "na3", arabic: "نَجْمَة", translit: "najma", french: "étoile", emoji: "⭐" },
      { id: "na4", arabic: "سَمَاء", translit: "samâ'", french: "ciel", emoji: "🌌" },
      { id: "na5", arabic: "بَحْر", translit: "baḥr", french: "mer", emoji: "🌊" },
      { id: "na6", arabic: "جَبَل", translit: "jabal", french: "montagne", emoji: "⛰️" },
      { id: "na7", arabic: "شَجَرَة", translit: "chajara", french: "arbre", emoji: "🌳" },
      { id: "na8", arabic: "وَرْدَة", translit: "warda", french: "rose / fleur", emoji: "🌹" },
      { id: "na9", arabic: "مَطَر", translit: "maṭar", french: "pluie", emoji: "🌧️" },
      { id: "na10", arabic: "رِيح", translit: "rîḥ", french: "vent", emoji: "💨" },
    ],
  },
  {
    id: "school",
    nameArabic: "المَدْرَسَة",
    nameFrench: "L'école",
    emoji: "🏫",
    color: "#74c2e8",
    bg: "#f0f8ff",
    words: [
      { id: "s1", arabic: "كِتَاب", translit: "kitâb", french: "livre", emoji: "📚" },
      { id: "s2", arabic: "قَلَم", translit: "qalam", french: "stylo / crayon", emoji: "✏️" },
      { id: "s3", arabic: "مَدْرَسَة", translit: "madrasa", french: "école", emoji: "🏫" },
      { id: "s4", arabic: "مُعَلِّم", translit: "mu'allim", french: "enseignant", emoji: "👨‍🏫" },
      { id: "s5", arabic: "تِلْمِيذ", translit: "tilmîdh", french: "élève", emoji: "🧑‍🎓" },
      { id: "s6", arabic: "سَبُّورَة", translit: "sabbûra", french: "tableau", emoji: "🖊️" },
      { id: "s7", arabic: "حَقِيبَة", translit: "ḥaqîba", french: "cartable", emoji: "🎒" },
      { id: "s8", arabic: "فَصْل", translit: "faṣl", french: "classe", emoji: "🏛️" },
    ],
  },
];
