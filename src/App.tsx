import { lazy, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ExportDialogHost } from "./components/share/ExportDialog";
import { ImportDialogHost, openImportFile } from "./components/share/ImportDialog";
import { Sidebar } from "./components/Sidebar";
import { DialogHost } from "./components/ui";
import { checkForUpdates, UpdateDialog } from "./components/UpdateDialog";
import { isTyping } from "./lib/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri, platform, type PickedFile } from "./lib/platform";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import Onboarding, { startFromShareFile } from "./pages/Onboarding";
import { saveNow, usePlaybook } from "./store/playbook";
import { useSettings } from "./store/settings";
import { useToasts } from "./store/toast";

const TacticEditor = lazy(() => import("./pages/TacticEditor"));
const LineupEditor = lazy(() => import("./pages/LineupEditor"));
const LineupsPage = lazy(() => import("./pages/LineupsPage"));
const RosterPage = lazy(() => import("./pages/RosterPage"));
const PoolPage = lazy(() => import("./pages/PoolPage"));
const VetoEditor = lazy(() => import("./pages/VetoEditor"));
const RoundsPage = lazy(() => import("./pages/RoundsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const status = usePlaybook((s) => s.status);
  const error = usePlaybook((s) => s.error);
  const accent = usePlaybook((s) => s.pb?.team.accent);

  useEffect(() => {
    usePlaybook.getState().load();
  }, []);

  // Team accent color drives the UI accent.
  useEffect(() => {
    if (accent) document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  // After load: update check + open the .cs2pb the app was launched with (once).
  const started = useRef(false);
  useEffect(() => {
    if (status !== "ready" && status !== "empty") return;
    const handle = (f: PickedFile) => (usePlaybook.getState().status === "empty" ? startFromShareFile(f) : openImportFile(f));
    if (!started.current) {
      started.current = true;
      if (useSettings.getState().checkUpdates) void checkForUpdates(false);
      platform.takeLaunchFile().then((f) => f && handle(f));
    }
    let unlisten: (() => void) | undefined;
    platform.onShareFileOpened(handle).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, [status]);

  // Write pending changes before the window closes.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async () => {
        await saveNow();
      })
      .then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  // Global undo / redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        usePlaybook.getState().undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        usePlaybook.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  let content;
  if (status === "loading") content = <div className="onboarding muted">{t("common.loading")}</div>;
  else if (status === "error")
    content = (
      <div className="onboarding">
        <div className="card pad" style={{ maxWidth: 560 }}>
          <h2>{t("app.loadError")}</h2>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{error}</p>
        </div>
      </div>
    );
  else if (status === "empty") content = <Onboarding />;
  else
    content = (
      <HashRouter>
        <div className="app">
          <Sidebar />
          <main className="main">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/map/:mapId" element={<MapPage />} />
                <Route path="/tactic/:tacticId" element={<TacticEditor />} />
                <Route path="/lineups" element={<LineupsPage />} />
                <Route path="/lineup/:lineupId" element={<LineupEditor />} />
                <Route path="/roster" element={<RosterPage />} />
                <Route path="/pool" element={<PoolPage />} />
                <Route path="/veto/:vetoId" element={<VetoEditor />} />
                <Route path="/rounds" element={<RoundsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        <ImportDialogHost />
        <ExportDialogHost />
      </HashRouter>
    );

  return (
    <>
      {content}
      <UpdateDialog />
      <DialogHost />
      <Toasts />
    </>
  );
}
