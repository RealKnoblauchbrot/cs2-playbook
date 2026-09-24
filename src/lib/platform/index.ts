import { tauriPlatform } from "./tauri";
import type { Platform } from "./types";
import { webPlatform } from "./web";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const platform: Platform = isTauri ? tauriPlatform : webPlatform;

export type { Platform, PickedFile, FileFilter } from "./types";
