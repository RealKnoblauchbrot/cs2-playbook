import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TokenStyle = "cutout" | "avatar";

interface SettingsState {
  language: string;
  tokenStyle: TokenStyle;
  tokenScale: number;
  showCallouts: boolean;
  checkUpdates: boolean;
  skippedVersion: string | null;
  /** Name put into exported share files ("exported by"). */
  userName: string;
  set<K extends keyof Omit<SettingsState, "set">>(key: K, value: SettingsState[K]): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: "en",
      tokenStyle: "cutout",
      tokenScale: 1,
      showCallouts: true,
      checkUpdates: true,
      skippedVersion: null,
      userName: "",
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
    }),
    { name: "cs2pb.settings" },
  ),
);
