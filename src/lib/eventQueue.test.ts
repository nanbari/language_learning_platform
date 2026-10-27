import { describe, it, expect } from "vitest";
import { EventQueue, type QueueStorage } from "./eventQueue";
import type { ExerciseEventInput } from "./exerciseEvents";

const event = (block: string): ExerciseEventInput => ({ lesson_id: "l", block_id: block, exercise_type: "quiz", event_type: "attempt", correct: true });

function memoryStorage(initial: string | null = null): QueueStorage & { value: string | null } {
  const s = { value: initial, read: () => s.value, write: (v: string) => { s.value = v; } };
  return s;
}

describe("EventQueue", () => {
  it("donne un identifiant à chaque événement et envoie par lots", async () => {
    const sent: ExerciseEventInput[][] = [];
    let n = 0;
    const q = new EventQueue({ storage: memoryStorage(), send: async (b) => { sent.push(b); return true; }, maxBatch: 2, newId: () => `id-${++n}` });
    q.push(event("a")); q.push(event("b")); q.push(event("c"));
    await q.flush();
    expect(sent.map((b) => b.map((e) => e.event_id))).toEqual([["id-1", "id-2"], ["id-3"]]);
    expect(q.pendingCount).toBe(0);
  });

  it("garde un lot refusé par le réseau, le persiste, et le renvoie tel quel (mêmes identifiants) au prochain envoi", async () => {
    const storage = memoryStorage();
    let online = false;
    const sent: ExerciseEventInput[][] = [];
    const q = new EventQueue({ storage, send: async (b) => { if (!online) throw new Error("offline"); sent.push(b); return true; }, maxBatch: 10, newId: () => "fixed-id" });
    q.push(event("a"));
    await q.flush();
    expect(q.pendingCount).toBe(1);
    expect(storage.value).toContain("fixed-id");

    // Nouvelle visite : la file est reconstruite depuis le stockage.
    online = true;
    const later = new EventQueue({ storage, send: async (b) => { sent.push(b); return true; }, maxBatch: 10, newId: () => "other" });
    expect(later.pendingCount).toBe(1);
    await later.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0][0].event_id).toBe("fixed-id");
    expect(later.pendingCount).toBe(0);
    expect(storage.value).toBe("[]");
  });

  it("un refus définitif (send → true après un 4xx) ne reste pas en attente ; un stockage cassé n'empêche rien", async () => {
    const broken: QueueStorage = { read: () => { throw new Error("quota"); }, write: () => { throw new Error("quota"); } };
    const q = new EventQueue({ storage: broken, send: async () => true, maxBatch: 10, newId: () => "x" });
    q.push(event("a"));
    await q.flush();
    expect(q.pendingCount).toBe(0);
  });

  it("borne le nombre d'événements en attente", async () => {
    const q = new EventQueue({ storage: memoryStorage(), send: async () => false, maxBatch: 1, newId: () => "x", maxPending: 3 });
    for (let i = 0; i < 6; i++) q.push(event(String(i)));
    await q.flush();
    expect(q.pendingCount).toBe(3);
  });
});
