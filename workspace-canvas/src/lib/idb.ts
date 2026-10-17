/* A tiny IndexedDB key-value store with an in-memory fallback (private windows, blocked storage). */
const DB = 'workspace-canvas';
const STORES = ['canvases', 'images', 'meta'] as const;
type Store = (typeof STORES)[number];

let dbp: Promise<IDBDatabase | null> | null = null;
const mem: Record<Store, Map<string, unknown>> = { canvases: new Map(), images: new Map(), meta: new Map() };

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

export async function idbGet<T>(store: Store, key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return mem[store].get(key) as T | undefined;
  return new Promise(resolve => {
    try {
      const r = db.transaction(store).objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => resolve(mem[store].get(key) as T | undefined);
    } catch { resolve(mem[store].get(key) as T | undefined); }
  });
}
export async function idbSet(store: Store, key: string, value: unknown): Promise<void> {
  mem[store].set(key, value);
  const db = await open(); if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); tx.onabort = () => resolve();
    } catch { resolve(); }
  });
}
export async function idbDel(store: Store, key: string): Promise<void> {
  mem[store].delete(key);
  const db = await open(); if (!db) return;
  return new Promise(resolve => {
    try { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); } catch { resolve(); }
  });
}
