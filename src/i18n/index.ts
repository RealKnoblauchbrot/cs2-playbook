import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useSettings } from "../store/settings";

/**
 * Locales are discovered automatically: add `src/locales/<code>.json`
 * (copy en.json, translate values, set `_meta.name`) and it shows up in Settings.
 */
const modules = import.meta.glob<Record<string, unknown>>("../locales/*.json", { eager: true, import: "default" });

export interface LocaleInfo {
  code: string;
  name: string;
}

const resources: Record<string, { translation: Record<string, unknown> }> = {};
export const LOCALES: LocaleInfo[] = [];

for (const [path, data] of Object.entries(modules)) {
  const code = path.match(/([\w-]+)\.json$/)![1];
  resources[code] = { translation: data };
  const meta = data._meta as { name?: string } | undefined;
  LOCALES.push({ code, name: meta?.name ?? code });
}
LOCALES.sort((a, b) => (a.code === "en" ? -1 : b.code === "en" ? 1 : a.name.localeCompare(b.name)));

i18n.use(initReactI18next).init({
  resources,
  lng: useSettings.getState().language,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

useSettings.subscribe((s, prev) => {
  if (s.language !== prev.language) i18n.changeLanguage(s.language);
});

export default i18n;
