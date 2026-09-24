import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import i18n from "../i18n";
import { isTauri } from "../lib/platform";
import { saveNow } from "../store/playbook";
import { useSettings } from "../store/settings";
import { toast } from "../store/toast";
import { Modal } from "./ui";

type Phase = "available" | "downloading" | "installing" | "error";

interface UpdaterState {
  update: Update | null;
  phase: Phase;
  downloaded: number;
  total: number;
  error: string;
  checking: boolean;
}

const useUpdater = create<UpdaterState>(() => ({
  update: null,
  phase: "available",
  downloaded: 0,
  total: 0,
  error: "",
  checking: false,
}));

/** Check GitHub releases for a newer version. `manual` ignores "skip this version". */
export async function checkForUpdates(manual = false): Promise<void> {
  if (!isTauri) {
    if (manual) toast.info(i18n.t("update.desktopOnly"));
    return;
  }
  useUpdater.setState({ checking: true });
  try {
    const update = await check({ timeout: 15000 });
    if (!update) {
      if (manual) toast.success(i18n.t("update.upToDate", { version: __APP_VERSION__ }));
      return;
    }
    if (!manual && useSettings.getState().skippedVersion === update.version) return;
    useUpdater.setState({ update, phase: "available", downloaded: 0, total: 0, error: "" });
  } catch (e) {
    // Offline or GitHub unreachable: stay quiet on automatic checks.
    console.warn("Update check failed", e);
    if (manual) toast.error(i18n.t("update.checkFailed", { error: String(e) }));
  } finally {
    useUpdater.setState({ checking: false });
  }
}

function releaseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw.replace(" ", "T").replace(/(\.\d+)? [+-].*$/, ""));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

export const useUpdateChecking = () => useUpdater((s) => s.checking);

export function UpdateDialog() {
  const { t } = useTranslation();
  const s = useUpdater();
  const setSetting = useSettings((x) => x.set);
  if (!s.update) return null;
  const u = s.update;
  const busy = s.phase === "downloading" || s.phase === "installing";

  const close = () => useUpdater.setState({ update: null });

  const install = async () => {
    try {
      await saveNow();
      useUpdater.setState({ phase: "downloading" });
      await u.downloadAndInstall((ev) => {
        if (ev.event === "Started") useUpdater.setState({ total: ev.data.contentLength ?? 0, downloaded: 0 });
        else if (ev.event === "Progress") useUpdater.setState((st) => ({ downloaded: st.downloaded + ev.data.chunkLength }));
        else if (ev.event === "Finished") useUpdater.setState({ phase: "installing" });
      });
      await relaunch();
    } catch (e) {
      useUpdater.setState({ phase: "error", error: String(e) });
    }
  };

  const pct = s.total ? Math.round((s.downloaded / s.total) * 100) : 0;

  return (
    <Modal
      title={t("update.title", { version: u.version })}
      onClose={close}
      dismissable={!busy}
      footer={
        busy ? null : (
          <>
            <button
              className="btn ghost"
              onClick={() => {
                setSetting("skippedVersion", u.version);
                close();
              }}
            >
              {t("update.skip")}
            </button>
            <button className="btn" onClick={close}>
              {t("update.later")}
            </button>
            <button className="btn primary" onClick={install}>
              {s.phase === "error" ? <RefreshCw size={15} /> : <Download size={15} />}
              {s.phase === "error" ? t("update.retry") : t("update.install")}
            </button>
          </>
        )
      }
    >
      <div className="col" style={{ gap: 12 }}>
        <div className="muted">
          {t("update.current", { current: u.currentVersion, next: u.version })}
          {releaseDate(u.date) && ` · ${releaseDate(u.date)}`}
        </div>
        {u.body && <div className="release-notes">{u.body}</div>}
        {busy && (
          <div className="col" style={{ gap: 6 }}>
            <div className="progress">
              <div style={{ width: `${s.phase === "installing" ? 100 : pct}%` }} />
            </div>
            <div className="small muted">
              {s.phase === "installing"
                ? t("update.installing")
                : t("update.downloading", { pct, mb: (s.total / 1048576).toFixed(1) })}
            </div>
          </div>
        )}
        {s.phase === "error" && <div style={{ color: "#ff8a80" }}>{s.error}</div>}
        {!busy && <div className="small muted">{t("update.dataSafe")}</div>}
      </div>
    </Modal>
  );
}
