import type { BackupInfo, Platform } from "./types";

/** IndexedDB-backed fallback so the UI can be developed in a normal browser. */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("cs2-playbook", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
      req.result.createObjectStore("media");
      req.result.createObjectStore("backups");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= openDb());

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function download(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const webPlatform: Platform = {
  isDesktop: false,

  loadPlaybook: () => tx<string | null>("kv", "readonly", (s) => s.get("playbook")).then((v) => v ?? null),
  savePlaybook: (json) => tx("kv", "readwrite", (s) => s.put(json, "playbook")),

  async writeBackup(json, reason) {
    const name = `${new Date().toISOString()}_${reason}.json`;
    await tx("backups", "readwrite", (s) => s.put(json, name));
  },
  async listBackups(): Promise<BackupInfo[]> {
    const keys = await tx<string[]>("backups", "readonly", (s) => s.getAllKeys());
    return keys.map((name) => ({ name, date: Date.parse(name.slice(0, 24)) || 0 })).sort((a, b) => b.date - a.date);
  },
  readBackup: (name) => tx<string | null>("backups", "readonly", (s) => s.get(name)).then((v) => v ?? null),

  readMedia: (id) => tx<Uint8Array | undefined>("media", "readonly", (s) => s.get(id)).then((v) => v ?? null),
  writeMedia: (id, bytes) => tx("media", "readwrite", (s) => s.put(bytes, id)),
  hasMedia: (id) => tx<number>("media", "readonly", (s) => s.count(id)).then((n) => n > 0),
  deleteMedia: (id) => tx("media", "readwrite", (s) => s.delete(id)),
  listMedia: () => tx<string[]>("media", "readonly", (s) => s.getAllKeys()),

  async saveFile(defaultName, _filters, bytes) {
    download(defaultName, bytes);
    return true;
  },
  async takeLaunchFile() {
    return null;
  },
  async onShareFileOpened() {
    return () => {};
  },
  async copyImage(png) {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([png as BlobPart], { type: "image/png" }) })]);
  },
  async dataLocation() {
    return "Browser storage (IndexedDB)";
  },
};
