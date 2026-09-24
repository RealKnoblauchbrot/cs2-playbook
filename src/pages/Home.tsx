import { FileText, Map as MapIcon, Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PdfDialog } from "../components/PdfDialog";
import { openExportDialog } from "../components/share/ExportDialog";
import { TacticCard } from "../components/TacticCard";
import { Stars } from "../components/ui";
import { mapCoverUrl, mapIconUrl } from "../data/maps";
import { orderedMaps } from "../model/selectors";
import { usePlaybook } from "../store/playbook";

export default function Home() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const [showAll, setShowAll] = useState(false);
  const [pdf, setPdf] = useState(false);
  const maps = orderedMaps(pb, !showAll);
  const recent = [...pb.tactics].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const favorites = pb.tactics.filter((x) => x.favorite);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{pb.team.name}</h1>
          <div className="sub">
            {t("home.stats", { tactics: pb.tactics.length, lineups: pb.lineups.length, players: pb.players.length })}
          </div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => setPdf(true)}>
          <FileText size={15} /> {t("pdf.button")}
        </button>
        <button className="btn primary" onClick={() => openExportDialog({ all: true })}>
          <Share2 size={15} /> {t("home.sharePlaybook")}
        </button>
      </div>

      <div className="section-title">
        <MapIcon size={17} />
        <h2>{t("home.mapPool")}</h2>
        <div className="spacer" />
        <label className="checkbox small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          {t("home.showAllMaps")}
        </label>
      </div>
      <div className="grid maps">
        {maps.map(({ def, data }) => {
          const tacs = pb.tactics.filter((x) => x.mapId === def.id);
          return (
            <div key={def.id} className={`card hover map-card ${data.inPool ? "" : "out"}`} onClick={() => nav(`/map/${def.id}`)}>
              <div className="cover" style={{ backgroundImage: `url(${mapCoverUrl(def.id)})` }}>
                <div className="title">
                  <img src={mapIconUrl(def.id)} alt="" />
                  <h3>{def.name}</h3>
                </div>
              </div>
              <div className="meta">
                <span className="badge t">T {tacs.filter((x) => x.side === "T").length}</span>
                <span className="badge ct">CT {tacs.filter((x) => x.side === "CT").length}</span>
                {data.status !== "neutral" && <span className={`badge ${data.status}`}>{t(`pool.status.${data.status}`)}</span>}
                <div className="spacer" />
                <Stars value={data.comfort} size={13} />
              </div>
            </div>
          );
        })}
      </div>

      {favorites.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t("home.favorites")}</h2>
          </div>
          <div className="grid tactics">
            {favorites.map((x) => (
              <TacticCard key={x.id} tactic={x} showMap />
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t("home.recent")}</h2>
          </div>
          <div className="grid tactics">
            {recent.map((x) => (
              <TacticCard key={x.id} tactic={x} showMap />
            ))}
          </div>
        </div>
      )}
      {pdf && <PdfDialog onClose={() => setPdf(false)} />}
    </div>
  );
}
