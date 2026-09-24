import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appDataDir } from "@tauri-apps/api/path";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { BackupInfo, Platform, PickedFile } from "./types";

const dir = { baseDir: BaseDirectory.AppData };
const PLAYBOOK = "playbook.json";
const MAX_BACKUPS = 20;

let dirsReady: Promise<void> | null = null;
function ensureDirs() {
  dirsReady ??= (async () => {
    for (const d of ["", "media", "backups"]) {
      if (!(await exists(d || ".", dir))) await mkdir(d || ".", { ...dir, recursive: true });
    }
  })();
  return dirsReady;
}

const safeName = (id: string) => {
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(id)) throw new Error(`Invalid media id: ${id}`);
  return `media/${id}`;
};

async function readShareFile(path: string): Promise<PickedFile> {
  const buf = await invoke<ArrayBuffer>("read_share_file", { path });
  return { name: path.split(/[\\/]/).pop() ?? "import.cs2pb", bytes: new Uint8Array(buf) };
}

export const tauriPlatform: Platform = {
  isDesktop: true,

  async loadPlaybook() {
    await ensureDirs();
    if (!(await exists(PLAYBOOK, dir))) return null;
    return readTextFile(PLAYBOOK, dir);
  },

  async savePlaybook(json) {
    await ensureDirs();
    // Write to temp file first, then swap, so a crash never leaves half a file.
    await writeTextFile("playbook.tmp.json", json, dir);
    await rename("playbook.tmp.json", PLAYBOOK, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  },

  async writeBackup(json, reason) {
    await ensureDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeTextFile(`backups/${stamp}_${reason.replace(/[^a-z0-9-]/gi, "")}.json`, json, dir);
    const all = await this.listBackups();
    for (const b of all.slice(MAX_BACKUPS)) await remove(`backups/${b.name}`, dir);
  },

  async listBackups(): Promise<BackupInfo[]> {
    await ensureDirs();
    const entries = await readDir("backups", dir);
    return entries
      .filter((e) => e.isFile && e.name.endsWith(".json"))
      .map((e) => {
        const iso = e.name.slice(0, 24).replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "$1:$2:$3.$4Z");
        return { name: e.name, date: Date.parse(iso) || 0 };
      })
      .sort((a, b) => b.date - a.date);
  },

  async readBackup(name) {
    if (!/^[\w.-]+\.json$/.test(name)) return null;
    return readTextFile(`backups/${name}`, dir);
  },

  async readMedia(id) {
    const p = safeName(id);
    if (!(await exists(p, dir))) return null;
    return readFile(p, dir);
  },

  async writeMedia(id, bytes) {
    await ensureDirs();
    await writeFile(safeName(id), bytes, dir);
  },

  async hasMedia(id) {
    return exists(safeName(id), dir);
  },

  async deleteMedia(id) {
    const p = safeName(id);
    if (await exists(p, dir)) await remove(p, dir);
  },

  async listMedia() {
    await ensureDirs();
    const entries = await readDir("media", dir);
    return entries.filter((e) => e.isFile).map((e) => e.name);
  },

  async saveFile(defaultName, filters, bytes) {
    const path = await save({ defaultPath: defaultName, filters });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  },

  async takeLaunchFile() {
    const path = await invoke<string | null>("launch_file");
    return path ? readShareFile(path) : null;
  },

  async onShareFileOpened(cb) {
    return listen<string>("open-share-file", async (e) => cb(await readShareFile(e.payload)));
  },

  async copyImage(png) {
    await writeImage(png);
  },

  async dataLocation() {
    return appDataDir();
  },
};
