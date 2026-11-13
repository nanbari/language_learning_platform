/**
 * Calendrier hebdomadaire des classes — calculs purs (plage d'heures, placement
 * des cours qui se chevauchent). L'affichage est dans
 * components/teacher/ClassCalendar.
 */
import { startMinutes, type ClassSchedule } from "@/lib/classes";

/** Plage affichée quand aucune classe n'a d'horaire : 9 h – 18 h. */
const DEFAULT_RANGE = { from: 9 * 60, to: 18 * 60 };
/** Une plage trop courte donnerait un calendrier écrasé. */
const MIN_RANGE_MINUTES = 4 * 60;
const DAY_MINUTES = 24 * 60;

/** Un cours placé dans la colonne de son jour. */
export interface PlacedClass<T> {
  item: T;
  /** Début et fin, en minutes depuis minuit. */
  from: number;
  to: number;
  /** Couloir du cours (0 = à gauche) et nombre de couloirs du groupe de cours qui se chevauchent. */
  lane: number;
  lanes: number;
}

/**
 * Heures à afficher (minutes depuis minuit, arrondies à l'heure) pour que tous
 * les cours tiennent, avec au moins MIN_RANGE_MINUTES de hauteur.
 */
export function calendarRange(schedules: ClassSchedule[]): { from: number; to: number } {
  if (schedules.length === 0) return DEFAULT_RANGE;
  let from = Math.min(...schedules.map((s) => Math.floor(startMinutes(s.start) / 60) * 60));
  let to = Math.max(...schedules.map((s) => Math.ceil((startMinutes(s.start) + s.minutes) / 60) * 60));
  if (to - from < MIN_RANGE_MINUTES) {
    to = Math.min(DAY_MINUTES, from + MIN_RANGE_MINUTES);
    from = Math.min(from, to - MIN_RANGE_MINUTES);
  }
  return { from, to };
}

/**
 * Place les cours d'un même jour : par ordre d'heure, et côte à côte quand ils
 * se chevauchent (un admin voit les classes de plusieurs enseignants).
 */
export function placeDay<T>(entries: { item: T; schedule: ClassSchedule }[]): PlacedClass<T>[] {
  const sorted = entries
    .map(({ item, schedule }) => {
      const from = startMinutes(schedule.start);
      return { item, from, to: from + schedule.minutes, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.from - b.from || b.to - a.to);

  let group: PlacedClass<T>[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = Math.max(0, ...group.map((e) => e.lane)) + 1;
    for (const e of group) e.lanes = lanes;
    group = [];
  };

  for (const event of sorted) {
    // Ce cours commence après la fin de tous ceux du groupe : nouveau groupe.
    if (group.length > 0 && event.from >= groupEnd) close();
    // Premier couloir libre à l'heure de début.
    const busy = new Set(group.filter((e) => e.to > event.from).map((e) => e.lane));
    let lane = 0;
    while (busy.has(lane)) lane++;
    event.lane = lane;
    group.push(event);
    groupEnd = Math.max(groupEnd, event.to);
  }
  if (group.length > 0) close();
  return sorted;
}
