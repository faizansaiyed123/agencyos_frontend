import { createSeedState } from "./seed";

export type DemoState = Record<string, any>;

const DB_NAME = "agencyos-recruiter-workspace";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "workspace-v1";

let dbPromise: Promise<IDBDatabase | null> | null = null;
let cachedState: DemoState | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

async function readSnapshot(): Promise<DemoState | null> {
  const db = await openDatabase();
  if (!db) {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) as DemoState : null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve((request.result as DemoState | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeSnapshot(state: DemoState): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(state));
    } catch {
      // The in-memory workspace remains usable when storage is unavailable.
    }
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(state, SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Workspace snapshot could not be saved"));
    tx.onabort = () => reject(tx.error ?? new Error("Workspace snapshot save was aborted"));
  });
}

export async function getDemoState(): Promise<DemoState> {
  if (cachedState) return cachedState;
  const persisted = await readSnapshot();
  cachedState = persisted ?? createSeedState();
  if (!persisted) await writeSnapshot(cachedState);
  return cachedState;
}

function cloneDemoState(state: DemoState): DemoState {
  if (typeof structuredClone === "function") return structuredClone(state);
  const clone = (value: any): any => {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === "object") {
      const result: Record<string, any> = {};
      for (const [key, item] of Object.entries(value)) result[key] = clone(item);
      return result;
    }
    return value;
  };
  return clone(state);
}

/** Each request works on an isolated snapshot and commits only after success. */
export async function withDemoState<T>(operation: (state: DemoState) => T | Promise<T>): Promise<T> {
  let result!: T;
  const next = writeQueue.then(async () => {
    const current = await getDemoState();
    const working = cloneDemoState(current);
    result = await operation(working);
    await writeSnapshot(working);
    cachedState = working;
  });
  writeQueue = next.catch(() => undefined);
  await next;
  return result;
}

export async function resetDemoState(): Promise<void> {
  const next = writeQueue.then(async () => {
    const fresh = createSeedState();
    await writeSnapshot(fresh);
    cachedState = fresh;
  });
  writeQueue = next.catch(() => undefined);
  await next;
}

export async function clearDemoState(): Promise<void> {
  const next = writeQueue.then(async () => {
    cachedState = null;
    const db = await openDatabase();
    if (!db) {
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch { /* storage is optional */ }
      return;
    }
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  });
  writeQueue = next.catch(() => undefined);
  await next;
}
