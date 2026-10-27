/**
 * File d'attente des événements d'exercice, indépendante du navigateur :
 * regroupe, envoie par lots, et **conserve** les lots qui n'ont pas pu partir
 * (réseau coupé, serveur indisponible) pour les renvoyer plus tard. Chaque
 * événement porte un identifiant unique choisi ici ; le serveur ignore un
 * doublon, donc renvoyer un lot n'enregistre jamais deux fois le même essai,
 * alors qu'un nouvel essai (nouvel identifiant) est toujours gardé.
 *
 * Les dépendances (stockage, envoi, horloge) sont injectées : testable en
 * Node, branchée sur localStorage + fetch dans lib/api/events.
 */
import type { ExerciseEventInput } from "@/lib/exerciseEvents";

export interface QueueStorage {
  read(): string | null;
  write(value: string): void;
}

export interface QueueOptions {
  storage: QueueStorage | null;
  /** Envoie un lot ; rejette (ou rend false) si le serveur ne l'a pas accepté de façon définitive. */
  send: (batch: ExerciseEventInput[]) => Promise<boolean>;
  maxBatch: number;
  newId: () => string;
  /** Au-delà, les lots les plus anciens sont abandonnés plutôt que de remplir le stockage. */
  maxPending?: number;
}

const MAX_PENDING_DEFAULT = 500;

export class EventQueue {
  private queue: ExerciseEventInput[] = [];
  private pending: ExerciseEventInput[][] = [];
  private inFlight = new Set<Promise<void>>();
  private flushing = false;

  constructor(private readonly opts: QueueOptions) {
    this.restore();
  }

  /** Met un événement en file, avec son identifiant. */
  push(event: ExerciseEventInput): void {
    this.queue.push({ ...event, event_id: event.event_id ?? this.opts.newId() });
  }

  /** Lots en attente de renvoi (persistés). */
  get pendingCount(): number { return this.pending.reduce((n, b) => n + b.length, 0); }
  get queuedCount(): number { return this.queue.length; }

  /**
   * Envoie tout : d'abord les lots en attente, puis la file courante. Un lot
   * refusé par le réseau reste en attente ; un lot accepté disparaît.
   */
  async flush(): Promise<void> {
    if (this.flushing) { await Promise.all([...this.inFlight]); return; }
    this.flushing = true;
    try {
      while (this.queue.length > 0) this.pending.push(this.queue.splice(0, this.opts.maxBatch));
      this.trim();
      this.persist();
      const batches = [...this.pending];
      for (const batch of batches) {
        const p = this.opts.send(batch)
          .then((ok) => { if (ok) this.pending = this.pending.filter((b) => b !== batch); })
          .catch(() => { /* reste en attente */ })
          .finally(() => { this.inFlight.delete(p); });
        this.inFlight.add(p);
        await p;
      }
      this.persist();
    } finally {
      this.flushing = false;
    }
  }

  private trim() {
    const max = this.opts.maxPending ?? MAX_PENDING_DEFAULT;
    while (this.pendingCount > max && this.pending.length > 1) this.pending.shift();
  }

  private persist() {
    try { this.opts.storage?.write(JSON.stringify(this.pending)); } catch { /* stockage indisponible */ }
  }

  private restore() {
    try {
      const raw = this.opts.storage?.read();
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed)) {
        this.pending = parsed.filter((b): b is ExerciseEventInput[] => Array.isArray(b) && b.length > 0);
      }
    } catch { this.pending = []; }
  }
}
