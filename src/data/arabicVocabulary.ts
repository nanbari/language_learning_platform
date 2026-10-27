export interface ArabicWord {
  id: string;
  arabic: string;        // الكلمة بالعربية (avec harakat)
  translit: string;      // translittération
  french: string;        // traduction française
  emoji: string;
  audio?: string;        // path to audio file
  /** Photo libre de droits sous /public/vocab (crédits : public/vocab/credits.json) ; sinon un dessin (WordArt) ou le pictogramme. */
  image?: string;
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
      { id: "a1", arabic: "أَسَد", translit: "asad", french: "lion", emoji: "🦁", image: "/vocab/animals/a1.webp" },
      { id: "a2", arabic: "فِيل", translit: "fîl", french: "éléphant", emoji: "🐘", image: "/vocab/animals/a2.webp" },
      { id: "a3", arabic: "قِرْد", translit: "qird", french: "singe", emoji: "🐒", image: "/vocab/animals/a3.webp" },
      { id: "a4", arabic: "زَرَافَة", translit: "zarâfa", french: "girafe", emoji: "🦒", image: "/vocab/animals/a4.webp" },
      { id: "a5", arabic: "دُبّ", translit: "dubb", french: "ours", emoji: "🐻", image: "/vocab/animals/a5.webp" },
      { id: "a6", arabic: "نَمِر", translit: "namir", french: "tigre", emoji: "🐯", image: "/vocab/animals/a6.webp" },
      { id: "a7", arabic: "حِصَان", translit: "ḥiṣân", french: "cheval", emoji: "🐴", image: "/vocab/animals/a7.webp" },
      { id: "a8", arabic: "بَقَرَة", translit: "baqara", french: "vache", emoji: "🐄", image: "/vocab/animals/a8.webp" },
      { id: "a9", arabic: "كَلْب", translit: "kalb", french: "chien", emoji: "🐕", image: "/vocab/animals/a9.webp" },
      { id: "a10", arabic: "هِرَّة", translit: "hirra", french: "chat", emoji: "🐱", image: "/vocab/animals/a10.webp" },
      { id: "a11", arabic: "أَرْنَب", translit: "arnab", french: "lapin", emoji: "🐰", image: "/vocab/animals/a11.webp" },
      { id: "a12", arabic: "سَمَكَة", translit: "samaka", french: "poisson", emoji: "🐟", image: "/vocab/animals/a12.webp" },
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
      { id: "fo1", arabic: "تُفَّاحَة", translit: "tuffâḥa", french: "pomme", emoji: "🍎", image: "/vocab/food/fo1.webp" },
      { id: "fo2", arabic: "مَوْز", translit: "mawz", french: "banane", emoji: "🍌", image: "/vocab/food/fo2.webp" },
      { id: "fo3", arabic: "خُبْز", translit: "khubz", french: "pain", emoji: "🍞", image: "/vocab/food/fo3.webp" },
      { id: "fo4", arabic: "حَلِيب", translit: "ḥalîb", french: "lait", emoji: "🥛" },
      { id: "fo5", arabic: "بَيْضَة", translit: "bayḍa", french: "œuf", emoji: "🥚", image: "/vocab/food/fo5.webp" },
      { id: "fo6", arabic: "لَحْم", translit: "laḥm", french: "viande", emoji: "🥩", image: "/vocab/food/fo6.webp" },
      { id: "fo7", arabic: "سَمَك", translit: "samak", french: "poisson", emoji: "🐟", image: "/vocab/food/fo7.webp" },
      { id: "fo8", arabic: "أَرُزّ", translit: "aruzz", french: "riz", emoji: "🍚", image: "/vocab/food/fo8.webp" },
      { id: "fo9", arabic: "مَاء", translit: "mâ'", french: "eau", emoji: "💧", image: "/vocab/food/fo9.webp" },
      { id: "fo10", arabic: "عَسَل", translit: "'asal", french: "miel", emoji: "🍯", image: "/vocab/food/fo10.webp" },
      { id: "fo11", arabic: "جَزَر", translit: "jazar", french: "carotte", emoji: "🥕", image: "/vocab/food/fo11.webp" },
      { id: "fo12", arabic: "لَيْمُون", translit: "laymûn", french: "citron", emoji: "🍋", image: "/vocab/food/fo12.webp" },
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
      { id: "na1", arabic: "شَمْس", translit: "chams", french: "soleil", emoji: "☀️", image: "/vocab/nature/na1.webp" },
      { id: "na2", arabic: "قَمَر", translit: "qamar", french: "lune", emoji: "🌙", image: "/vocab/nature/na2.webp" },
      { id: "na3", arabic: "نَجْمَة", translit: "najma", french: "étoile", emoji: "⭐", image: "/vocab/nature/na3.webp" },
      { id: "na4", arabic: "سَمَاء", translit: "samâ'", french: "ciel", emoji: "🌌", image: "/vocab/nature/na4.webp" },
      { id: "na5", arabic: "بَحْر", translit: "baḥr", french: "mer", emoji: "🌊", image: "/vocab/nature/na5.webp" },
      { id: "na6", arabic: "جَبَل", translit: "jabal", french: "montagne", emoji: "⛰️", image: "/vocab/nature/na6.webp" },
      { id: "na7", arabic: "شَجَرَة", translit: "chajara", french: "arbre", emoji: "🌳", image: "/vocab/nature/na7.webp" },
      { id: "na8", arabic: "وَرْدَة", translit: "warda", french: "rose / fleur", emoji: "🌹", image: "/vocab/nature/na8.webp" },
      { id: "na9", arabic: "مَطَر", translit: "maṭar", french: "pluie", emoji: "🌧️", image: "/vocab/nature/na9.webp" },
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
      { id: "s2", arabic: "قَلَم", translit: "qalam", french: "stylo / crayon", emoji: "✏️", image: "/vocab/school/s2.webp" },
      { id: "s3", arabic: "مَدْرَسَة", translit: "madrasa", french: "école", emoji: "🏫", image: "/vocab/school/s3.webp" },
      { id: "s4", arabic: "مُعَلِّم", translit: "mu'allim", french: "enseignant", emoji: "👨‍🏫" },
      { id: "s5", arabic: "تِلْمِيذ", translit: "tilmîdh", french: "élève", emoji: "🧑‍🎓" },
      { id: "s6", arabic: "سَبُّورَة", translit: "sabbûra", french: "tableau", emoji: "🖊️", image: "/vocab/school/s6.webp" },
      { id: "s7", arabic: "حَقِيبَة", translit: "ḥaqîba", french: "cartable", emoji: "🎒", image: "/vocab/school/s7.webp" },
      { id: "s8", arabic: "فَصْل", translit: "faṣl", french: "classe", emoji: "🏛️", image: "/vocab/school/s8.webp" },
    ],
  },
];
