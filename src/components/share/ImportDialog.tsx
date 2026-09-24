import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { mapName } from "../../data/maps";
import { pickFiles } from "../../lib/media";
import { platform, type PickedFile } from "../../lib/platform";
import {
  analyzeImport,
  applyImport,
  readShareFile,
  SHARE_EXT,
  writeImportedMedia,
  type ImportAction,
  type ImportGroup,
  type ImportItem,
  type ShareContents,
} from "../../lib/share";
import { getPb, updatePb } from "../../store/playbook";
import { toast } from "../../store/toast";
import { Modal } from "../ui";

const useImportDialog = create<{ contents: ShareContents | null; fileName: string }>(() => ({ contents: null, fileName: "" }));

export function openImportFile(file: PickedFile) {
  try {
    const contents = readShareFile(file.bytes);
    useImportDialog.setState({ contents, fileName: file.name });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

export async function pickAndImport() {
  const [file] = await pickFiles(`.${SHARE_EXT}`);
  if (!file) return;
  openImportFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
}

export function ImportDialogHost() {
  const { contents, fileName } = useImportDialog();
  if (!contents) return null;
  return <ImportDialog contents={contents} fileName={fileName} onClose={() => useImportDialog.setState({ contents: null })} />;
}

const GROUP_ORDER: ImportGroup[] = ["team", "players", "roles", "roleAssignments", "maps", "tactics", "lineups", "vetos", "rounds"];

function ImportDialog({ contents, fileName, onClose }: { contents: ShareContents; fileName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ImportItem[]>(() => analyzeImport(getPb(), contents));
  const [busy, setBusy] = useState(false);
  const [showSame, setShowSame] = useState(false);
  const m = contents.manifest;

  const byGroup = useMemo(() => {
    const g = new Map<ImportGroup, ImportItem[]>();
    for (const it of items) {
      if (!showSame && it.status === "same") continue;
      g.set(it.group, [...(g.get(it.group) ?? []), it]);
    }
    return g;
  }, [items, showSame]);

  const setAction = (key: string, action: ImportAction) => setItems((list) => list.map((i) => (i.key === key ? { ...i, action } : i)));
  const setGroup = (group: ImportGroup, action: ImportAction) =>
    setItems((list) => list.map((i) => (i.group === group && i.actions.includes(action) ? { ...i, action } : i)));

  const count = items.filter((i) => i.action !== "skip").length;
  const sameCount = items.filter((i) => i.status === "same").length;

  const itemName = (i: ImportItem) => {
    if (i.group === "maps") return mapName(i.id);
    if (i.group === "tactics") {
      const tac = contents.data.tactics.find((x) => x.id === i.id);
      return tac ? `${mapName(tac.mapId)} · ${tac.side} · ${tac.name}` : i.name;
    }
    if (i.group === "lineups") {
      const l = contents.data.lineups.find((x) => x.id === i.id);
      return l ? `${mapName(l.mapId)} · ${l.name}` : i.name;
    }
    return i.name || t("common.untitled");
  };

  const doImport = async () => {
    setBusy(true);
    try {
      await platform.writeBackup(JSON.stringify(getPb()), "before-import");
      await writeImportedMedia(contents);
      updatePb((d) => applyImport(d, contents, items));
      toast.success(t("import.done", { count }));
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t("import.title")}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <span className="muted small grow">{t("import.backupHint")}</span>
          <button className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" disabled={busy || count === 0} onClick={doImport}>
            <FileUp size={15} /> {t("import.apply", { count })}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 12 }}>
        <div className="card pad" style={{ padding: 12 }}>
          <div style={{ fontWeight: 650 }}>{fileName}</div>
          <div className="muted small">
            {t("import.from", {
              who: m.exportedBy || t("import.unknown"),
              team: m.teamName,
              date: new Date(m.exportedAt).toLocaleString(),
              version: m.appVersion,
            })}
          </div>
        </div>
        {sameCount > 0 && (
          <label className="checkbox small">
            <input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} />
            {t("import.showSame", { count: sameCount })}
          </label>
        )}
        {byGroup.size === 0 ? (
          <div className="empty">{t("import.nothingNew")}</div>
        ) : (
          <div className="import-list">
            {GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => (
              <div key={g}>
                <div className="import-group">
                  <span className="grow">
                    {t(`import.group.${g}`)} ({byGroup.get(g)!.length})
                  </span>
                  <button className="btn sm ghost" onClick={() => setGroup(g, "skip")}>
                    {t("import.skipAll")}
                  </button>
                  <button className="btn sm ghost" onClick={() => { setGroup(g, "add"); setGroup(g, "replace"); }}>
                    {t("import.takeAll")}
                  </button>
                </div>
                {byGroup.get(g)!.map((i) => (
                  <div key={i.key} className="import-item">
                    <span className="ellipsis">{itemName(i)}</span>
                    <span className={`status ${i.status === "changed" ? "newer" : i.status}`}>{t(`import.status.${i.status}`)}</span>
                    <select className="select sm" value={i.action} onChange={(e) => setAction(i.key, e.target.value as ImportAction)}>
                      {i.actions.map((a) => (
                        <option key={a} value={a}>
                          {t(`import.action.${a}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
