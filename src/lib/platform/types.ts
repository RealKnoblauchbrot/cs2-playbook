export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

export interface BackupInfo {
  name: string;
  date: number;
}

/**
 * Everything that touches the OS. The Tauri implementation stores data in
 * %APPDATA%; the web implementation (used for `npm run dev` in a browser)
 * falls back to IndexedDB and browser downloads.
 */
export interface Platform {
  readonly isDesktop: boolean;

  loadPlaybook(): Promise<string | null>;
  savePlaybook(json: string): Promise<void>;

  writeBackup(json: string, reason: string): Promise<void>;
  listBackups(): Promise<BackupInfo[]>;
  readBackup(name: string): Promise<string | null>;

  readMedia(id: string): Promise<Uint8Array | null>;
  writeMedia(id: string, bytes: Uint8Array): Promise<void>;
  hasMedia(id: string): Promise<boolean>;
  deleteMedia(id: string): Promise<void>;
  listMedia(): Promise<string[]>;

  /** Ask where to save and write the file. Returns false if cancelled. */
  saveFile(defaultName: string, filters: FileFilter[], bytes: Uint8Array): Promise<boolean>;
  /** File the app was launched with (double-clicked .cs2pb). */
  takeLaunchFile(): Promise<PickedFile | null>;
  /** Subscribe to .cs2pb files opened while the app is running. */
  onShareFileOpened(cb: (file: PickedFile) => void): Promise<() => void>;

  copyImage(png: Uint8Array): Promise<void>;
  dataLocation(): Promise<string>;
}
