import { ArchiveRestore, Download, FolderOpen, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { confirmDialog, Field, Segmented } from "../components/ui";
import { checkForUpdates, useUpdateChecking } from "../components/UpdateDialog";
import { LOCALES } from "../i18n";
import { platform } from "../lib/platform";
import type { BackupInfo } from "../lib/platform/types";
import { getPb, usePlaybook } from "../store/playbook";
import { useSettings, type TokenStyle } from "../store/settings";
import { toast } from "../store/toast";

export default function SettingsPage() {
  const { t } = useTranslation();
  const s = useSettings();
  const checking = useUpdateChecking();
  const [location, setLocation] = useState("");
  const [backups, setBackups] = useState<BackupInfo[]>([]);

  const refresh = () => platform.listBackups().then(setBackups).catch(() => setBackups([]));
  useEffect(() => {
    platform.dataLocation().then(setLocation);
    refresh();
  }, []);

  const restore = async (b: BackupInfo) => {
    if (!(await confirmDialog({ title: t("settings.restoreConfirm"), text: t("settings.restoreText"), okLabel: t("settings.restore") }))) return;
    const json = await platform.readBackup(b.name);
    if (!json) return;
    try {
      await usePlaybook.getState().replace(JSON.parse(json), "before-restore");
      toast.success(t("settings.restored"));
      refresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const backupNow = async () => {
    await platform.writeBackup(JSON.stringify(getPb()), "manual");
    toast.success(t("settings.backupDone"));
    refresh();
  };

  const reset = async () => {
    if (!(await confirmDialog({ title: t("settings.resetConfirm"), text: t("settings.resetText"), danger: true, okLabel: t("settings.reset") }))) return;
    await platform.writeBackup(JSON.stringify(getPb()), "before-reset");
    usePlaybook.setState({ pb: null, status: "empty", past: [], future: [] });
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>{t("nav.settings")}</h1>
      </div>

      <div className="card pad col" style={{ gap: 16 }}>
        <h2>{t("settings.general")}</h2>
        <div className="form-grid">
          <Field label={t("settings.language")}>
            <select className="select" value={s.language} onChange={(e) => s.set("language", e.target.value)}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("settings.yourName")}>
            <input className="input" value={s.userName} placeholder={t("export.exportedByPh")} onChange={(e) => s.set("userName", e.target.value)} />
          </Field>
        </div>
        <div className="muted small">{t("settings.languageHint")}</div>
      </div>

      <div className="card pad col section" style={{ gap: 16 }}>
        <h2>{t("settings.board")}</h2>
        <div className="form-grid">
          <Field label={t("settings.tokenStyle")}>
            <Segmented<TokenStyle>
              value={s.tokenStyle}
              onChange={(v) => s.set("tokenStyle", v)}
              options={[
                { value: "cutout", label: t("settings.cutout") },
                { value: "avatar", label: t("settings.avatar") },
              ]}
            />
          </Field>
          <Field label={t("settings.tokenScale", { pct: Math.round(s.tokenScale * 100) })}>
            <input type="range" min={0.6} max={1.6} step={0.05} value={s.tokenScale} onChange={(e) => s.set("tokenScale", Number(e.target.value))} />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={s.showCallouts} onChange={(e) => s.set("showCallouts", e.target.checked)} />
          {t("settings.showCallouts")}
        </label>
      </div>

      <div className="card pad col section" style={{ gap: 12 }}>
        <h2>{t("settings.updates")}</h2>
        <div className="row">
          <span className="grow">{t("settings.version", { version: __APP_VERSION__ })}</span>
          <button className="btn" disabled={checking || !platform.isDesktop} onClick={() => checkForUpdates(true)}>
            <RefreshCw size={15} className={checking ? "spin" : ""} /> {checking ? t("settings.checking") : t("settings.checkNow")}
          </button>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={s.checkUpdates} onChange={(e) => s.set("checkUpdates", e.target.checked)} />
          {t("settings.autoCheck")}
        </label>
        {s.skippedVersion && (
          <div className="row small muted">
            {t("settings.skipped", { version: s.skippedVersion })}
            <button className="btn sm ghost" onClick={() => s.set("skippedVersion", null)}>
              {t("settings.unskip")}
            </button>
          </div>
        )}
      </div>

      <div className="card pad col section" style={{ gap: 12 }}>
        <h2>{t("settings.data")}</h2>
        <div className="row small">
          <FolderOpen size={15} className="muted" />
          <span className="mono muted" style={{ userSelect: "text", wordBreak: "break-all" }}>{location}</span>
        </div>
        <div className="muted small">{t("settings.dataHint")}</div>
        <div className="row">
          <h3 className="grow">{t("settings.backups")}</h3>
          <button className="btn sm" onClick={backupNow}>
            <Download size={14} /> {t("settings.backupNow")}
          </button>
        </div>
        <div className="card" style={{ maxHeight: 280, overflow: "auto" }}>
          {backups.length === 0 && <div className="muted small" style={{ padding: 12 }}>{t("settings.noBackups")}</div>}
          {backups.map((b) => (
            <div key={b.name} className="row" style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)" }}>
              <span className="grow">{b.date ? new Date(b.date).toLocaleString() : b.name}</span>
              <span className="muted small">{t(`backupReason.${b.name.replace(/^.*_|\.json$/g, "")}`, { defaultValue: b.name.replace(/^.*_|\.json$/g, "") })}</span>
              <button className="btn sm ghost" onClick={() => restore(b)}>
                <ArchiveRestore size={14} /> {t("settings.restore")}
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="grow muted small">{t("settings.resetHint")}</div>
          <button className="btn danger" onClick={reset}>
            <RotateCcw size={15} /> {t("settings.reset")}
          </button>
        </div>
      </div>

      <div className="muted small section" style={{ textAlign: "center" }}>
        CS2 Playbook v{__APP_VERSION__} · github.com/RealKnoblauchbrot/cs2-playbook
        <br />
        {t("settings.assetsNote")}
      </div>
    </div>
  );
}
