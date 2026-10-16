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
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function parseName(name: unknown): Parsed<string> {
  if (typeof name !== "string") return { ok: false, error: "Le nom de la classe est requis" };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, error: "Le nom de la classe est requis" };
  if (clean.length > MAX_CLASS_NAME) return { ok: false, error: `Le nom doit faire au plus ${MAX_CLASS_NAME} caractères` };
  return { ok: true, value: clean };
}

/** Valide le corps de « Nouvelle classe ». */
export function parseNewClass(input: unknown): Parsed<{ name: string }> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "corps invalide" };
  const name = parseName((input as Record<string, unknown>).name);
  return name.ok ? { ok: true, value: { name: name.value } } : name;
}

/** Valide une modification de classe : nouveau nom et/ou liste complète des élèves. */
export function parseClassUpdate(input: unknown): Parsed<ClassUpdate> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "corps invalide" };
  const { name, studentIds } = input as Record<string, unknown>;
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
  if (value.name === undefined && value.studentIds === undefined) return { ok: false, error: "rien à modifier" };
  return { ok: true, value };
}

/** Le cours est-il encore en direct ? */
export function isLive(room: string | null, startedAt: string | null, now: number = Date.now()): boolean {
  if (!room || !startedAt) return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && now - started < LIVE_MAX_HOURS * 3600_000;
}
