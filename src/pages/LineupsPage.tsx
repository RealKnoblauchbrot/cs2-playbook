import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { LineupsView } from "../components/LineupsView";
import { mapIconUrl } from "../data/maps";
import { orderedMaps } from "../model/selectors";
import { usePlaybook } from "../store/playbook";

export default function LineupsPage() {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const [params, setParams] = useSearchParams();
  const maps = orderedMaps(pb, true);
  const mapId = params.get("map") ?? maps[0]?.def.id ?? "de_dust2";

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("nav.lineups")}</h1>
        <div className="spacer" />
        <div className="row wrap" style={{ gap: 4 }}>
          {maps.map(({ def }) => (
            <button
              key={def.id}
              className={`btn sm ${def.id === mapId ? "active" : ""}`}
              onClick={() => setParams({ map: def.id }, { replace: true })}
            >
              <img src={mapIconUrl(def.id)} alt="" style={{ width: 16, height: 16 }} />
              {def.name}
              <span className="muted small">{pb.lineups.filter((l) => l.mapId === def.id).length || ""}</span>
            </button>
          ))}
        </div>
      </div>
      <LineupsView key={mapId} mapId={mapId} />
    </div>
  );
}
