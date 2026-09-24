import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { mapName } from "../../data/maps";
import { buildShareFile, SHARE_EXT, SHARE_FILTER, type ExportSelection } from "../../lib/share";
import { platform } from "../../lib/platform";
import { orderedMaps } from "../../model/selectors";
import type { ID } from "../../model/types";
import { usePlaybook } from "../../store/playbook";
import { useSettings } from "../../store/settings";
import { toast } from "../../store/toast";
import { Field, Modal } from "../ui";

interface Preset {
  tacticIds?: ID[];
  lineupIds?: ID[];
  vetoIds?: ID[];
  roundIds?: ID[];
  all?: boolean;
}

const useExportDialog = create<{ preset: Preset | null }>(() => ({ preset: null }));
export const openExportDialog = (preset: Preset = { all: true }) => useExportDialog.setState({ preset });

export function ExportDialogHost() {
  const preset = useExportDialog((s) => s.preset);
  if (!preset) return null;
  return <ExportDialog preset={preset} onClose={() => useExportDialog.setState({ preset: null })} />;
}

function ExportDialog({ preset, onClose }: { preset: Preset; onClose: () => void }) {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<ExportSelection>(() =>
    preset.all
      ? {
          tacticIds: pb.tactics.map((x) => x.id),
          lineupIds: pb.lineups.map((x) => x.id),
          vetoIds: pb.vetos.map((x) => x.id),
          roundIds: pb.rounds.map((x) => x.id),
          roster: true,
          maps: true,
        }
      : {
          tacticIds: preset.tacticIds ?? [],
          lineupIds: preset.lineupIds ?? [],
          vetoIds: preset.vetoIds ?? [],
          roundIds: preset.roundIds ?? [],
          roster: false,
          maps: false,
        },
  );

  const maps = useMemo(() => orderedMaps(pb).map((m) => m.def), [pb]);

  const toggle = (key: "tacticIds" | "lineupIds" | "vetoIds" | "roundIds", ids: ID[], on: boolean) =>
    setSel((s) => {
      const set = new Set(s[key]);
      ids.forEach((id) => (on ? set.add(id) : set.delete(id)));
      return { ...s, [key]: [...set] };
    });

  const all = sel.roster && sel.maps && sel.tacticIds.length === pb.tactics.length && sel.lineupIds.length === pb.lineups.length &&
    sel.vetoIds.length === pb.vetos.length && sel.roundIds.length === pb.rounds.length;

  const setAll = (on: boolean) =>
    setSel({
      tacticIds: on ? pb.tactics.map((x) => x.id) : [],
      lineupIds: on ? pb.lineups.map((x) => x.id) : [],
      vetoIds: on ? pb.vetos.map((x) => x.id) : [],
      roundIds: on ? pb.rounds.map((x) => x.id) : [],
      roster: on,
      maps: on,
    });

  const nothing = !sel.roster && !sel.maps && !sel.tacticIds.length && !sel.lineupIds.length && !sel.vetoIds.length && !sel.roundIds.length;

  const doExport = async () => {
    setBusy(true);
    try {
      const bytes = await buildShareFile(pb, sel, settings.userName);
      const date = new Date().toISOString().slice(0, 10);
      const single = !all && sel.tacticIds.length === 1 && !sel.lineupIds.length ? pb.tactics.find((x) => x.id === sel.tacticIds[0]) : null;
      const base = single ? `${mapName(single.mapId)}_${single.name}` : `${pb.team.name}_${all ? "playbook" : "export"}_${date}`;
      const name = `${base.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_")}.${SHARE_EXT}`;
      if (await platform.saveFile(name, SHARE_FILTER, bytes)) {
        toast.success(t("export.shareSaved"));
        onClose();
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const group = (
    title: string,
    key: "tacticIds" | "lineupIds",
    items: { id: ID; name: string; mapId: string }[],
  ) =>
    items.length > 0 && (
      <div className="col" style={{ gap: 4 }}>
        <div className="label">{title}</div>
        {maps.map((m) => {
          const list = items.filter((i) => i.mapId === m.id);
          if (!list.length) return null;
          const on = list.every((i) => sel[key].includes(i.id));
          return (
            <div key={m.id} style={{ marginLeft: 4 }}>
              <label className="checkbox small" style={{ fontWeight: 600 }}>
                <input type="checkbox" checked={on} onChange={(e) => toggle(key, list.map((i) => i.id), e.target.checked)} />
                {m.name} <span className="muted">({list.length})</span>
              </label>
              <div className="col" style={{ gap: 2, marginLeft: 24, marginTop: 2 }}>
                {list.map((i) => (
                  <label key={i.id} className="checkbox small">
                    <input type="checkbox" checked={sel[key].includes(i.id)} onChange={(e) => toggle(key, [i.id], e.target.checked)} />
                    {i.name || t("common.untitled")}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <Modal
      title={t("export.title")}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <span className="muted small grow">{t("export.hint")}</span>
          <button className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" disabled={busy || nothing} onClick={doExport}>
            <FileDown size={15} /> {busy ? t("common.working") : t("export.save")}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="row">
          <Field label={t("export.exportedBy")} style={{ flex: 1 }}>
            <input className="input sm" value={settings.userName} placeholder={t("export.exportedByPh")} onChange={(e) => settings.set("userName", e.target.value)} />
          </Field>
          <label className="checkbox" style={{ alignSelf: "flex-end", paddingBottom: 4 }}>
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t("export.everything")}
          </label>
        </div>
        <div className="grid two" style={{ alignItems: "start" }}>
          <div className="col" style={{ gap: 10 }}>
            <label className="checkbox">
              <input type="checkbox" checked={sel.roster} onChange={(e) => setSel({ ...sel, roster: e.target.checked })} />
              {t("export.roster")}
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={sel.maps} onChange={(e) => setSel({ ...sel, maps: e.target.checked })} />
              {t("export.maps")}
            </label>
            {pb.vetos.length > 0 && (
              <div className="col" style={{ gap: 2 }}>
                <div className="label">{t("nav.pool")}</div>
                {pb.vetos.map((v) => (
                  <label key={v.id} className="checkbox small">
                    <input type="checkbox" checked={sel.vetoIds.includes(v.id)} onChange={(e) => toggle("vetoIds", [v.id], e.target.checked)} />
                    {v.name || v.opponent || t("common.untitled")}
                  </label>
                ))}
              </div>
            )}
            {pb.rounds.length > 0 && (
              <div className="col" style={{ gap: 2 }}>
                <div className="label">{t("nav.rounds")}</div>
                {pb.rounds.map((r) => (
                  <label key={r.id} className="checkbox small">
                    <input type="checkbox" checked={sel.roundIds.includes(r.id)} onChange={(e) => toggle("roundIds", [r.id], e.target.checked)} />
                    {r.name || t("common.untitled")}
                  </label>
                ))}
              </div>
            )}
            {group(t("nav.lineups"), "lineupIds", pb.lineups)}
          </div>
          <div className="col" style={{ gap: 10 }}>{group(t("nav.tactics"), "tacticIds", pb.tactics)}</div>
        </div>
      </div>
    </Modal>
  );
}
