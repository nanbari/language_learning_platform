import type { ArabicLetter } from "@/data/arabicAlphabet";

/**
 * Son d'une lettre : l'enregistrement de l'enseignante s'il existe
 * (`public/sounds/letters/<numéro>.mp3`), sinon la voix arabe de l'appareil.
 */

export function letterSoundUrl(letter: ArabicLetter): string {
  return `/sounds/letters/${letter.id}.mp3`;
}

/** Ce que la voix de synthèse prononce : la lettre portant une fatha (« بَ »). */
export function spokenSound(letter: ArabicLetter): string {
  return `${letter.id === 1 ? "أ" : letter.isolated}َ`;
}

let current: HTMLAudioElement | null = null;

function speak(letter: ArabicLetter) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenSound(letter));
  utterance.lang = "ar-SA";
  utterance.rate = 0.8;
  const voice = synth.getVoices().find((v) => v.lang.startsWith("ar"));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

/** Un seul son à la fois : en lancer un coupe le précédent. */
export function playLetterSound(letter: ArabicLetter) {
  current?.pause();
  window.speechSynthesis?.cancel();
  const audio = new Audio(letterSoundUrl(letter));
  current = audio;
  // Fichier absent ou illisible : la voix de l'appareil prend le relais.
  audio.play().catch(() => { if (current === audio) speak(letter); });
}
