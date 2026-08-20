export interface ArabicLetter {
  id: number;
  name: string;           // اسم الحرف
  nameTranslit: string;   // ex: "Alif"
  isolated: string;       // ا
  initial: string;        // أ
  medial: string;         // ـأـ
  final: string;          // ـا
  translit: string;       // "a"
  example: string;        // أسد
  exampleMeaning: string; // lion
  exampleTranslit: string;
  color: string;
  group: "moon" | "sun";  // حروف قمرية / شمسية
}

export const ARABIC_ALPHABET: ArabicLetter[] = [
  { id: 1, name: "أَلِف", nameTranslit: "Alif", isolated: "ا", initial: "ا", medial: "ـا", final: "ـا", translit: "a / â", example: "أَسَد", exampleMeaning: "lion", exampleTranslit: "asad", color: "#f9a875", group: "moon" },
  { id: 2, name: "بَاء", nameTranslit: "Bâ", isolated: "ب", initial: "بـ", medial: "ـبـ", final: "ـب", translit: "b", example: "بَيْت", exampleMeaning: "maison", exampleTranslit: "bayt", color: "#ffd166", group: "moon" },
  { id: 3, name: "تَاء", nameTranslit: "Tâ", isolated: "ت", initial: "تـ", medial: "ـتـ", final: "ـت", translit: "t", example: "تُفَّاحَة", exampleMeaning: "pomme", exampleTranslit: "tuffâha", color: "#95d5b2", group: "sun" },
  { id: 4, name: "ثَاء", nameTranslit: "Thâ", isolated: "ث", initial: "ثـ", medial: "ـثـ", final: "ـث", translit: "th", example: "ثَعْلَب", exampleMeaning: "renard", exampleTranslit: "tha'lab", color: "#74c2e8", group: "sun" },
  { id: 5, name: "جِيم", nameTranslit: "Jîm", isolated: "ج", initial: "جـ", medial: "ـجـ", final: "ـج", translit: "j", example: "جَمَل", exampleMeaning: "chameau", exampleTranslit: "jamal", color: "#c9b1e8", group: "moon" },
  { id: 6, name: "حَاء", nameTranslit: "Hâ", isolated: "ح", initial: "حـ", medial: "ـحـ", final: "ـح", translit: "ḥ", example: "حِصَان", exampleMeaning: "cheval", exampleTranslit: "ḥiṣân", color: "#ff8fa3", group: "moon" },
  { id: 7, name: "خَاء", nameTranslit: "Khâ", isolated: "خ", initial: "خـ", medial: "ـخـ", final: "ـخ", translit: "kh", example: "خُبْز", exampleMeaning: "pain", exampleTranslit: "khubz", color: "#f9a875", group: "moon" },
  { id: 8, name: "دَال", nameTranslit: "Dâl", isolated: "د", initial: "د", medial: "ـد", final: "ـد", translit: "d", example: "دُبّ", exampleMeaning: "ours", exampleTranslit: "dubb", color: "#ffd166", group: "sun" },
  { id: 9, name: "ذَال", nameTranslit: "Dhâl", isolated: "ذ", initial: "ذ", medial: "ـذ", final: "ـذ", translit: "dh", example: "ذِئْب", exampleMeaning: "loup", exampleTranslit: "dhi'b", color: "#95d5b2", group: "sun" },
  { id: 10, name: "رَاء", nameTranslit: "Râ", isolated: "ر", initial: "ر", medial: "ـر", final: "ـر", translit: "r", example: "رُمَّان", exampleMeaning: "grenade", exampleTranslit: "rummân", color: "#74c2e8", group: "sun" },
  { id: 11, name: "زَاي", nameTranslit: "Zây", isolated: "ز", initial: "ز", medial: "ـز", final: "ـز", translit: "z", example: "زَرَافَة", exampleMeaning: "girafe", exampleTranslit: "zarâfa", color: "#c9b1e8", group: "sun" },
  { id: 12, name: "سِين", nameTranslit: "Sîn", isolated: "س", initial: "سـ", medial: "ـسـ", final: "ـس", translit: "s", example: "سَمَكَة", exampleMeaning: "poisson", exampleTranslit: "samaka", color: "#ff8fa3", group: "sun" },
  { id: 13, name: "شِين", nameTranslit: "Chîn", isolated: "ش", initial: "شـ", medial: "ـشـ", final: "ـش", translit: "ch", example: "شَمْس", exampleMeaning: "soleil", exampleTranslit: "chams", color: "#f9a875", group: "sun" },
  { id: 14, name: "صَاد", nameTranslit: "Sâd", isolated: "ص", initial: "صـ", medial: "ـصـ", final: "ـص", translit: "ṣ", example: "صَقْر", exampleMeaning: "faucon", exampleTranslit: "ṣaqr", color: "#ffd166", group: "sun" },
  { id: 15, name: "ضَاد", nameTranslit: "Dâd", isolated: "ض", initial: "ضـ", medial: "ـضـ", final: "ـض", translit: "ḍ", example: "ضِفْدَع", exampleMeaning: "grenouille", exampleTranslit: "ḍifda'", color: "#95d5b2", group: "sun" },
  { id: 16, name: "طَاء", nameTranslit: "Tâ'", isolated: "ط", initial: "طـ", medial: "ـطـ", final: "ـط", translit: "ṭ", example: "طَاوُوس", exampleMeaning: "paon", exampleTranslit: "ṭâwûs", color: "#74c2e8", group: "sun" },
  { id: 17, name: "ظَاء", nameTranslit: "Dhâ'", isolated: "ظ", initial: "ظـ", medial: "ـظـ", final: "ـظ", translit: "ẓ", example: "ظَبْي", exampleMeaning: "gazelle", exampleTranslit: "ẓaby", color: "#c9b1e8", group: "sun" },
  { id: 18, name: "عَيْن", nameTranslit: "'Ayn", isolated: "ع", initial: "عـ", medial: "ـعـ", final: "ـع", translit: "'", example: "عَيْن", exampleMeaning: "œil", exampleTranslit: "'ayn", color: "#ff8fa3", group: "moon" },
  { id: 19, name: "غَيْن", nameTranslit: "Ghayn", isolated: "غ", initial: "غـ", medial: "ـغـ", final: "ـغ", translit: "gh", example: "غُرَاب", exampleMeaning: "corbeau", exampleTranslit: "ghurâb", color: "#f9a875", group: "moon" },
  { id: 20, name: "فَاء", nameTranslit: "Fâ", isolated: "ف", initial: "فـ", medial: "ـفـ", final: "ـف", translit: "f", example: "فِيل", exampleMeaning: "éléphant", exampleTranslit: "fîl", color: "#ffd166", group: "moon" },
  { id: 21, name: "قَاف", nameTranslit: "Qâf", isolated: "ق", initial: "قـ", medial: "ـقـ", final: "ـق", translit: "q", example: "قِرْد", exampleMeaning: "singe", exampleTranslit: "qird", color: "#95d5b2", group: "moon" },
  { id: 22, name: "كَاف", nameTranslit: "Kâf", isolated: "ك", initial: "كـ", medial: "ـكـ", final: "ـك", translit: "k", example: "كَلْب", exampleMeaning: "chien", exampleTranslit: "kalb", color: "#74c2e8", group: "moon" },
  { id: 23, name: "لَام", nameTranslit: "Lâm", isolated: "ل", initial: "لـ", medial: "ـلـ", final: "ـل", translit: "l", example: "لَيْمُون", exampleMeaning: "citron", exampleTranslit: "laymûn", color: "#c9b1e8", group: "sun" },
  { id: 24, name: "مِيم", nameTranslit: "Mîm", isolated: "م", initial: "مـ", medial: "ـمـ", final: "ـم", translit: "m", example: "مَاء", exampleMeaning: "eau", exampleTranslit: "mâ'", color: "#ff8fa3", group: "moon" },
  { id: 25, name: "نُون", nameTranslit: "Nûn", isolated: "ن", initial: "نـ", medial: "ـنـ", final: "ـن", translit: "n", example: "نَمِر", exampleMeaning: "tigre", exampleTranslit: "namir", color: "#f9a875", group: "sun" },
  { id: 26, name: "هَاء", nameTranslit: "Hâ'", isolated: "ه", initial: "هـ", medial: "ـهـ", final: "ـه", translit: "h", example: "هِرَّة", exampleMeaning: "chat", exampleTranslit: "hirra", color: "#ffd166", group: "moon" },
  { id: 27, name: "وَاو", nameTranslit: "Wâw", isolated: "و", initial: "و", medial: "ـو", final: "ـو", translit: "w / û", example: "وَرْدَة", exampleMeaning: "rose", exampleTranslit: "warda", color: "#95d5b2", group: "moon" },
  { id: 28, name: "يَاء", nameTranslit: "Yâ", isolated: "ي", initial: "يـ", medial: "ـيـ", final: "ـي", translit: "y / î", example: "يَد", exampleMeaning: "main", exampleTranslit: "yad", color: "#74c2e8", group: "sun" },
];
