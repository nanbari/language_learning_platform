// Validation des identifiants : lib/uuid, partagée par tous les modèles.
import { isUuid } from "@/lib/uuid";
export { isUuid };

/**
 * Classes d'élèves — modèle partagé client / serveur.
 *
 * Un enseignant regroupe ses élèves en classes (un élève peut être dans
 * plusieurs). Le cours en direct se lance pour une classe : il reçoit un
 * salon tiré au hasard, que le serveur ne donne qu'aux élèves de la classe.
 * Un admin voit et gère toutes les classes.
 */

export const MAX_CLASS_NAME = 60;
/** Au-delà, un cours resté « en direct » (onglet fermé sans quitter) est considéré terminé. */
export const LIVE_MAX_HOURS = 6;
const MAX_MEMBERS = 50;

/** Jours de la semaine, lundi en premier : `ClassSchedule.day` vaut l'indice + 1. */
export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export const MIN_CLASS_MINUTES = 15;
export const MAX_CLASS_MINUTES = 480;
export const DEFAULT_CLASS_MINUTES = 60;

/**
 * Créneau hebdomadaire d'une classe : le jour et l'heure où elle a cours,
 * chaque semaine. L'heure est celle de l'école (heure affichée au mur), sans
 * fuseau : « mercredi 14 h » reste « mercredi 14 h » été comme hiver.
 */
export interface ClassSchedule {
  /** 1 = lundi … 7 = dimanche. */
  day: number;
  /** Heure de début, "HH:MM" sur 24 heures. */
  start: string;
  /** Durée du cours, en minutes. */
  minutes: number;
}

export interface StudentRef {
  id: string;
  name: string;
}

/** Une classe vue par l'enseignant. */
export interface ClassRow {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  live: boolean;
  /** null tant que l'enseignant n'a pas indiqué quand la classe a cours. */
  schedule: ClassSchedule | null;
}

export interface TeacherClasses {
  classes: ClassRow[];
  /** Tous les élèves de la plateforme, pour composer les classes. */
  students: StudentRef[];
}

/** Un cours en direct ouvert à l'élève. */
export interface LiveClass {
  id: string;
  name: string;
  teacherName: string;
  room: string;
}

export interface ClassUpdate {
  name?: string;
  studentIds?: string[];
  /** null retire l'horaire. */
  schedule?: ClassSchedule | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };


function parseName(name: unknown): Parsed<string> {
  if (typeof name !== "string") return { ok: false, error: "Le nom de la classe est requis" };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, error: "Le nom de la classe est requis" };
  if (clean.length > MAX_CLASS_NAME) return { ok: false, error: `Le nom doit faire au plus ${MAX_CLASS_NAME} caractères` };
  return { ok: true, value: clean };
}

const START_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes écoulées depuis minuit pour une heure "HH:MM". */
export function startMinutes(start: string): number {
  const m = START_RE.exec(start);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Valide un créneau ; `null` (ou absent) signifie « sans horaire ». */
function parseSchedule(input: unknown): Parsed<ClassSchedule | null> {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "horaire invalide" };
  const { day, start, minutes } = input as Record<string, unknown>;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 7) return { ok: false, error: "Choisissez le jour du cours" };
  if (typeof start !== "string" || !START_RE.test(start)) return { ok: false, error: "Indiquez l'heure de début du cours" };
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < MIN_CLASS_MINUTES || minutes > MAX_CLASS_MINUTES) {
    return { ok: false, error: `La durée du cours doit être comprise entre ${MIN_CLASS_MINUTES} minutes et ${MAX_CLASS_MINUTES / 60} heures` };
  }
  if (startMinutes(start) + minutes > 24 * 60) return { ok: false, error: "Le cours doit se terminer avant minuit" };
  return { ok: true, value: { day, start, minutes } };
}

/** Créneau lu en base (colonnes schedule_*), ou null s'il est absent ou incohérent. */
export function scheduleFromRow(row: { schedule_day?: number | null; schedule_start?: string | null; schedule_minutes?: number | null }): ClassSchedule | null {
  if (row.schedule_day == null || row.schedule_start == null || row.schedule_minutes == null) return null;
  const parsed = parseSchedule({ day: row.schedule_day, start: row.schedule_start.slice(0, 5), minutes: row.schedule_minutes });
  return parsed.ok ? parsed.value : null;
}

/** Colonnes à écrire en base pour un créneau (toutes à null pour « sans horaire »). */
export function scheduleColumns(schedule: ClassSchedule | null) {
  return { schedule_day: schedule?.day ?? null, schedule_start: schedule?.start ?? null, schedule_minutes: schedule?.minutes ?? null };
}

/** « 14 h », « 9 h 30 » : l'heure telle qu'on l'écrit en français. */
export function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** « 14 h – 15 h » */
export function formatHours(schedule: ClassSchedule): string {
  const from = startMinutes(schedule.start);
  return `${formatClock(from)} – ${formatClock(from + schedule.minutes)}`;
}

/** « Mercredi, 14 h – 15 h » */
export function formatSchedule(schedule: ClassSchedule): string {
  return `${WEEKDAYS[schedule.day - 1]}, ${formatHours(schedule)}`;
}

/** Valide le corps de « Nouvelle classe » : un nom, et l'horaire s'il est déjà connu. */
export function parseNewClass(input: unknown): Parsed<{ name: string; schedule: ClassSchedule | null }> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "corps invalide" };
  const { name: rawName, schedule: rawSchedule } = input as Record<string, unknown>;
  const name = parseName(rawName);
  if (!name.ok) return name;
  const schedule = parseSchedule(rawSchedule);
  if (!schedule.ok) return schedule;
  return { ok: true, value: { name: name.value, schedule: schedule.value } };
}

/** Valide une modification de classe : nouveau nom, liste complète des élèves et/ou horaire. */
export function parseClassUpdate(input: unknown): Parsed<ClassUpdate> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "corps invalide" };
  const { name, studentIds, schedule } = input as Record<string, unknown>;
  const value: ClassUpdate = {};

  if (name !== undefined) {
    const parsed = parseName(name);
    if (!parsed.ok) return parsed;
    value.name = parsed.value;
  }
  if (studentIds !== undefined) {
    if (!Array.isArray(studentIds) || !studentIds.every(isUuid)) return { ok: false, error: "liste d'élèves invalide" };
    const unique = [...new Set(studentIds)];
    if (unique.length > MAX_MEMBERS) return { ok: false, error: `Une classe compte au plus ${MAX_MEMBERS} élèves` };
    value.studentIds = unique;
  }
  if (schedule !== undefined) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    value.schedule = parsed.value;
  }
  if (value.name === undefined && value.studentIds === undefined && value.schedule === undefined) return { ok: false, error: "rien à modifier" };
  return { ok: true, value };
}

/** Le cours est-il encore en direct ? */
export function isLive(room: string | null, startedAt: string | null, now: number = Date.now()): boolean {
  if (!room || !startedAt) return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && now - started < LIVE_MAX_HOURS * 3600_000;
}
