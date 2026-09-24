import { produce, type Draft } from "immer";
import { create } from "zustand";
import { platform } from "../lib/platform";
import { migratePlaybook } from "../model/migrate";
import type { Playbook } from "../model/types";

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;
const SAVE_DEBOUNCE_MS = 400;
const DAILY_BACKUP_KEY = "cs2pb.lastDailyBackup";

type Recipe = (draft: Draft<Playbook>) => void;

interface UpdateOptions {
  /** Consecutive updates with the same key (within 1s) form one undo step, e.g. typing. */
  coalesce?: string;
  /** Skip the undo history (e.g. internal bookkeeping). */
  noHistory?: boolean;
}

interface PlaybookState {
  pb: Playbook | null;
  status: "loading" | "empty" | "ready" | "error";
  error: string | null;
  saving: boolean;
  past: Playbook[];
  future: Playbook[];
  lastCoalesce: { key: string; at: number } | null;

  load(): Promise<void>;
  /** Replace the whole playbook (onboarding, import, restore). Always backs up first. */
  replace(pb: Playbook, backupReason?: string): Promise<void>;
  update(recipe: Recipe, opts?: UpdateOptions): void;
  undo(): void;
  redo(): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: Playbook | null = null;

async function flushSave() {
  clearTimeout(saveTimer);
  const pb = pendingSave;
  pendingSave = null;
  if (!pb) return;
  usePlaybook.setState({ saving: true });
  try {
    await platform.savePlaybook(JSON.stringify(pb));
  } catch (e) {
    console.error("Save failed", e);
    usePlaybook.setState({ error: `Save failed: ${e}` });
  } finally {
    usePlaybook.setState({ saving: false });
  }
}

function scheduleSave(pb: Playbook) {
  pendingSave = pb;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

window.addEventListener("beforeunload", () => void flushSave());

export const usePlaybook = create<PlaybookState>()((set, get) => ({
  pb: null,
  status: "loading",
  error: null,
  saving: false,
  past: [],
  future: [],
  lastCoalesce: null,

  async load() {
    try {
      const json = await platform.loadPlaybook();
      if (!json) {
        set({ status: "empty" });
        return;
      }
      const pb = migratePlaybook(JSON.parse(json));
      set({ pb, status: "ready", past: [], future: [] });
      const last = Number(localStorage.getItem(DAILY_BACKUP_KEY) ?? 0);
      if (Date.now() - last > 24 * 3600 * 1000) {
        await platform.writeBackup(json, "daily");
        localStorage.setItem(DAILY_BACKUP_KEY, String(Date.now()));
      }
    } catch (e) {
      console.error(e);
      set({ status: "error", error: String(e) });
    }
  },

  async replace(pb, backupReason = "replace") {
    const current = get().pb;
    if (current) await platform.writeBackup(JSON.stringify(current), backupReason);
    const next = migratePlaybook(pb);
    set({ pb: next, status: "ready", past: current ? [current] : [], future: [] });
    pendingSave = next;
    await flushSave();
  },

  update(recipe, opts = {}) {
    const { pb, past, lastCoalesce } = get();
    if (!pb) return;
    const next = produce(pb, (d) => {
      recipe(d);
      d.updatedAt = Date.now();
    });
    if (next === pb) return;
    const t = Date.now();
    const merge = !!opts.coalesce && lastCoalesce?.key === opts.coalesce && t - lastCoalesce.at < COALESCE_MS;
    set({
      pb: next,
      past: opts.noHistory || merge ? past : [...past.slice(-HISTORY_LIMIT + 1), pb],
      future: opts.noHistory ? get().future : [],
      lastCoalesce: opts.coalesce ? { key: opts.coalesce, at: t } : null,
    });
    scheduleSave(next);
  },

  undo() {
    const { pb, past, future } = get();
    if (!pb || past.length === 0) return;
    const prev = past[past.length - 1];
    set({ pb: prev, past: past.slice(0, -1), future: [pb, ...future], lastCoalesce: null });
    scheduleSave(prev);
  },

  redo() {
    const { pb, past, future } = get();
    if (!pb || future.length === 0) return;
    const next = future[0];
    set({ pb: next, past: [...past, pb], future: future.slice(1), lastCoalesce: null });
    scheduleSave(next);
  },
}));

/** Access the loaded playbook (only call below the "ready" gate in App). */
export function usePb<T>(selector: (pb: Playbook) => T): T {
  return usePlaybook((s) => selector(s.pb as Playbook));
}

export const updatePb = (recipe: Recipe, opts?: UpdateOptions) => usePlaybook.getState().update(recipe, opts);
export const getPb = () => usePlaybook.getState().pb as Playbook;
export const saveNow = flushSave;
