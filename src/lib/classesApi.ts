import type { ClassUpdate, LiveClass, TeacherClasses } from "@/lib/classes";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  return data as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Enseignant : ses classes et la liste des élèves. */
export async function fetchTeacherClasses() {
  return jsonOrThrow<TeacherClasses>(await fetch("/api/classes", { cache: "no-store" }));
}

/** Élève : les cours en direct de ses classes. */
export async function fetchLiveClasses() {
  return jsonOrThrow<LiveClass[]>(await fetch("/api/classes", { cache: "no-store" }));
}

export async function createClass(name: string) {
  return jsonOrThrow<{ id: string }>(await fetch("/api/classes", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name }) }));
}

export async function updateClass(id: string, update: ClassUpdate) {
  return jsonOrThrow<{ ok: true }>(await fetch(`/api/classes/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(update) }));
}

export async function deleteClass(id: string) {
  return jsonOrThrow<{ ok: true }>(await fetch(`/api/classes/${id}`, { method: "DELETE" }));
}

/** Lance le cours en direct de la classe ; renvoie son salon. */
export async function startLive(classId: string) {
  return jsonOrThrow<{ room: string }>(await fetch(`/api/classes/${classId}/live`, { method: "POST" }));
}

/** Termine le cours ; `keepalive` pour aboutir même si l'onglet se ferme. */
export function stopLive(classId: string, room: string) {
  return fetch(`/api/classes/${classId}/live?room=${encodeURIComponent(room)}`, { method: "DELETE", keepalive: true }).catch(() => {});
}
