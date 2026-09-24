import { FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { mapIconUrl } from "../data/maps";
import { buildPlaybookPdf } from "../lib/pdf";
import { platform } from "../lib/platform";
import { orderedMaps } from "../model/selectors";
import { usePlaybook } from "../store/playbook";
import { toast } from "../store/toast";
import { Modal } from "./ui";

export function PdfDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const pool = orderedMaps(pb, true);
  const [mapIds, setMapIds] = useState<string[]>(pool.filter((m) => pb.tactics.some((x) => x.mapId === m.def.id)).map((m) => m.def.id));
  const [cover, setCover] = useState(true);
  const [lineups, setLineups] = useState(true);
  const [rounds, setRounds] = useState(pb.rounds.length > 0);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const build = async () => {
    setProgress([0, 1]);
    try {
      const bytes = await buildPlaybookPdf(pb, { mapIds, cover, lineups, rounds, onProgress: (d, total) => setProgress([d, total]) });
      const name = `${pb.team.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "team"}_playbook_${new Date().toISOString().slice(0, 10)}.pdf`;
      if (await platform.saveFile(name, [{ name: "PDF", extensions: ["pdf"] }], bytes)) {
        toast.success(t("export.saved"));
        onClose();
      }
    } catch (e) {
      console.error(e);
      toast.error(String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal
      title={t("pdf.title")}
      onClose={onClose}
      dismissable={!progress}
      footer={
        <>
          {progress && (
            <div className="grow">
              <div className="progress">
                <div style={{ width: `${(progress[0] / Math.max(1, progress[1])) * 100}%` }} />
              </div>
            </div>
          )}
          <button className="btn ghost" onClick={onClose} disabled={!!progress}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" onClick={build} disabled={!!progress || (!mapIds.length && !cover && !rounds)}>
            <FileText size={15} /> {progress ? t("common.working") : t("pdf.create")}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 12 }}>
        <div className="label">{t("pdf.maps")}</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {pool.map(({ def }) => {
            const on = mapIds.includes(def.id);
            const n = pb.tactics.filter((x) => x.mapId === def.id).length;
            return (
              <button key={def.id} className={`btn sm ${on ? "active" : ""}`} onClick={() => setMapIds(on ? mapIds.filter((x) => x !== def.id) : [...mapIds, def.id])}>
                <img src={mapIconUrl(def.id)} alt="" style={{ width: 16, height: 16 }} />
                {def.name} <span className="muted">{n}</span>
              </button>
            );
          })}
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} /> {t("pdf.cover")}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={lineups} onChange={(e) => setLineups(e.target.checked)} /> {t("pdf.lineups")}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={rounds} onChange={(e) => setRounds(e.target.checked)} /> {t("pdf.rounds")}
        </label>
      </div>
    </Modal>
  );
}
