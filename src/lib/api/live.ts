import type { LiveHostView, LiveRoomView, LiveState } from "@/lib/liveSession";
import { apiFetch } from "@/lib/api/client";

/**
 * Appels des routes de la séance en direct (/api/classes/:id/live/*). Le
 * navigateur ne fait que demander : le serveur vérifie session, classe et
 * salon à chaque requête.
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

const base = (classId: string, room: string, path: string) =>
  `/api/classes/${encodeURIComponent(classId)}/live/${path}?room=${encodeURIComponent(room)}`;

export interface LiveTokenResponse {
  token: string;
  expiresAt: number;
  topics: { control: string; video: string };
  teacherId: string;
  role: "teacher" | "student";
}

export const fetchLiveToken = (classId: string, room: string) => apiFetch<LiveTokenResponse>(base(classId, room, "token"));

export const fetchLiveState = (classId: string, room: string) => apiFetch<LiveRoomView>(base(classId, room, "state"));

export const pushLiveState = (classId: string, room: string, state: LiveState) =>
  apiFetch<{ ok: true }>(base(classId, room, "state"), { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(state) });

export const sendLiveAnswer = (classId: string, room: string, slideIndex: number, choiceId: string) =>
  apiFetch<{ correct: boolean }>(base(classId, room, "answers"), { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ slideIndex, choiceId }) });

export const fetchLiveAnswers = (classId: string, room: string) => apiFetch<LiveHostView>(base(classId, room, "answers"));

export const muteAllLive = (classId: string, room: string) => apiFetch<{ ok: true }>(base(classId, room, "mute"), { method: "POST" });
