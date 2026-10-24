/**
 * Un seul lecteur audio pour toute la plateforme.
 *
 * Sur iPhone, iPad et beaucoup d'Android, un son ne peut démarrer que juste
 * après un toucher, et cette autorisation vaut pour l'élément <audio> qui l'a
 * reçue. Créer un nouvel `Audio()` par son faisait donc jouer le premier (au
 * toucher) puis bloquait tous ceux lancés après un délai : consigne de
 * l'exercice suivant, réponse après « bravo », son chargé à distance.
 *
 * Ici, le même élément sert pour tous les sons : débloqué une fois (au premier
 * toucher, avec un court silence s'il n'a encore rien joué), il peut ensuite
 * jouer sans geste. Un seul son à la fois : en lancer un coupe le précédent.
 */

const SILENCE = "/sounds/silence.mp3";

let player: HTMLAudioElement | null = null;
let unlocked = false;

function audio(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

function unlock() {
  if (unlocked) return;
  const a = audio();
  // Un vrai son en cours de lecture débloque aussi l'élément.
  if (!a.paused) return;
  a.src = SILENCE;
  a.play().then(() => { unlocked = true; }).catch(() => {});
}

if (typeof document !== "undefined") {
  for (const event of ["pointerdown", "touchend", "keydown"]) {
    document.addEventListener(event, unlock, { capture: true, passive: true });
  }
}

/**
 * Joue `url` à la place du son en cours. Résout `true` si la lecture a
 * démarré, `false` si le fichier est illisible ou si le navigateur refuse.
 * `onEnded` est appelé à la fin du son (pas s'il est coupé).
 */
export function playSound(url: string, onEnded?: () => void): Promise<boolean> {
  const a = audio();
  a.pause();
  a.onended = onEnded ? () => { a.onended = null; onEnded(); } : null;
  a.src = url;
  return a.play().then(
    () => { unlocked = true; return true; },
    () => { a.onended = null; return false; },
  );
}

/** Coupe le son en cours ; avec `url`, seulement si c'est ce son-là. */
export function stopSound(url?: string) {
  if (!player) return;
  if (url && !player.src.endsWith(url)) return;
  player.onended = null;
  player.pause();
}
