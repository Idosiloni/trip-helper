// Tiny key-value store on IndexedDB (SPEC §10: the active trip is kept on the
// device). Falls back to memory where IndexedDB is missing (tests, old browsers,
// private modes that block it), so callers never have to care.

export type KV = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
};

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    get: async <T,>(k: string) => structuredClone(m.get(k)) as T | undefined,
    set: async (k, v) => void m.set(k, structuredClone(v)),
    del: async (k) => void m.delete(k),
    keys: async (prefix = "") => [...m.keys()].filter((k) => k.startsWith(prefix)),
    clear: async () => m.clear(),
  };
}

const DB = "triphelper";
const STORE = "kv";

function idbKV(): KV {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  return {
    get: <T,>(k: string) => run<T | undefined>("readonly", (s) => s.get(k) as IDBRequest<T | undefined>),
    set: async (k, v) => void (await run("readwrite", (s) => s.put(v, k))),
    del: async (k) => void (await run("readwrite", (s) => s.delete(k))),
    keys: async (prefix = "") => ((await run("readonly", (s) => s.getAllKeys())) as IDBValidKey[]).map(String).filter((k) => k.startsWith(prefix)),
    clear: async () => void (await run("readwrite", (s) => s.clear())),
  };
}

let instance: KV | null = null;

/** The device store. Every call is best effort: failures fall back to memory. */
export function kv(): KV {
  if (instance) return instance;
  const real = typeof indexedDB !== "undefined" ? idbKV() : null;
  const mem = memoryKV();
  if (!real) return (instance = mem);
  const safe = <A extends unknown[], R>(f: (...a: A) => Promise<R>, g: (...a: A) => Promise<R>) =>
    (...a: A) => f(...a).catch(() => g(...a));
  instance = {
    get: safe(real.get, mem.get) as KV["get"],
    set: safe(real.set, mem.set),
    del: safe(real.del, mem.del),
    keys: safe(real.keys, mem.keys),
    clear: safe(real.clear, mem.clear),
  };
  return instance;
}

/** For tests. */
export function setKV(k: KV | null) {
  instance = k;
}
