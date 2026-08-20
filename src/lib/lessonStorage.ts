/**
 * Storage layer for lessons.
 *
 * Lesson metadata (titles, text, structure) lives in localStorage.
 * Binary blobs (audio, images) live in IndexedDB and are referenced
 * by an "idb:<key>" string. On load, references are resolved to
 * blob URLs so existing <img> / new Audio() usage works unchanged.
 *
 * Legacy lessons with inline data: URLs are read transparently and
 * get migrated to IDB on next save.
 */

const DB_NAME = "ms_assets";
const STORE   = "assets";
const VERSION = 1;
const LS_KEY  = "ms_lessons";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

async function putBlob(blob: Blob): Promise<string> {
  const db = await openDB();
  const key = uid();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error);
  });
  return `idb:${key}`;
}

async function getBlob(ref: string): Promise<Blob | null> {
  const db = await openDB();
  const key = ref.slice(4);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteBlob(ref: string): Promise<void> {
  if (!ref.startsWith("idb:")) return;
  const db = await openDB();
  const key = ref.slice(4);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// Map blob: URLs (returned from inlineRefs) back to their original idb: ref
// so that when the same lesson is saved again, the existing IDB entry is
// reused instead of creating a fresh one (which would orphan the old blob).
const blobUrlToRef = new Map<string, string>();

/**
 * Recursively replace inline data: URLs in `obj` with "idb:<key>"
 * references after storing the blob in IndexedDB. blob: URLs that were
 * created by a previous loadLesson are also resolved back to their
 * original idb: ref. Other strings are left untouched.
 */
async function externalize(obj: unknown): Promise<unknown> {
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(externalize));
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = await externalize(v);
    return out;
  }
  if (typeof obj === "string" && obj.startsWith("data:")) {
    const blob = await fetch(obj).then((r) => r.blob());
    return await putBlob(blob);
  }
  if (typeof obj === "string" && obj.startsWith("blob:")) {
    const known = blobUrlToRef.get(obj);
    if (known) return known;
    // Unknown blob URL — try to re-fetch; if invalid (stale from a previous
    // page session), drop the field so the user can re-upload the asset.
    try {
      const blob = await fetch(obj).then((r) => r.blob());
      return await putBlob(blob);
    } catch {
      return undefined;
    }
  }
  return obj;
}

/**
 * Recursively replace "idb:<key>" references with blob URLs that the
 * caller can hand directly to <img>, <audio>, etc. Returns a list of
 * created URLs so the caller can revoke them when done.
 */
async function inlineRefs(obj: unknown, urls: string[]): Promise<unknown> {
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((v) => inlineRefs(v, urls)));
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = await inlineRefs(v, urls);
    return out;
  }
  if (typeof obj === "string" && obj.startsWith("idb:")) {
    const blob = await getBlob(obj);
    if (!blob) return obj;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    blobUrlToRef.set(url, obj);
    return url;
  }
  return obj;
}

export interface LessonRecord {
  id: string;
  title: string;
  createdAt: string;
  blocks?: unknown[];
  // legacy fields
  videos?: unknown[];
  slideshow?: unknown[];
  exercises?: unknown[];
}

function readLessonsRaw(): LessonRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}

function writeLessonsRaw(lessons: LessonRecord[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(lessons));
}

/** List lessons without resolving any binary content (metadata only). */
export function listLessons(): LessonRecord[] {
  return readLessonsRaw();
}

/** Load a single lesson and resolve all binary refs to blob URLs. */
export async function loadLesson(id: string): Promise<{ lesson: LessonRecord | null; urls: string[] }> {
  const all = readLessonsRaw();
  const found = all.find((l) => l.id === id);
  if (!found) return { lesson: null, urls: [] };
  const urls: string[] = [];
  const resolved = (await inlineRefs(found, urls)) as LessonRecord;
  return { lesson: resolved, urls };
}

/** Save a lesson: write blobs to IDB, store JSON with refs in localStorage. */
export async function saveLesson(lesson: LessonRecord, opts: { editId?: string } = {}): Promise<void> {
  const externalized = (await externalize(lesson)) as LessonRecord;
  const all = readLessonsRaw();
  let next: LessonRecord[];
  if (opts.editId) {
    next = all.map((l) => l.id === opts.editId ? { ...externalized, id: opts.editId } : l);
  } else {
    next = [externalized, ...all];
  }
  writeLessonsRaw(next);
}

/** Free blob URLs created by loadLesson. Call on unmount. */
export function releaseUrls(urls: string[]): void {
  for (const u of urls) {
    URL.revokeObjectURL(u);
    blobUrlToRef.delete(u);
  }
}

/** Delete a lesson and its binary assets. */
export async function deleteLesson(id: string): Promise<void> {
  const all = readLessonsRaw();
  const target = all.find((l) => l.id === id);
  if (target) {
    const refs: string[] = [];
    const collect = (obj: unknown): void => {
      if (Array.isArray(obj)) { obj.forEach(collect); return; }
      if (obj && typeof obj === "object") { Object.values(obj).forEach(collect); return; }
      if (typeof obj === "string" && obj.startsWith("idb:")) refs.push(obj);
    };
    collect(target);
    await Promise.all(refs.map(deleteBlob));
  }
  writeLessonsRaw(all.filter((l) => l.id !== id));
}
