import { Crosshair, FileDown, FileUp, Home, ListChecks, Settings, Shield, Swords, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { mapIconUrl } from "../data/maps";
import { useMediaUrl } from "../lib/media";
import { orderedMaps } from "../model/selectors";
import { usePlaybook } from "../store/playbook";
import { openExportDialog } from "./share/ExportDialog";
import { pickAndImport } from "./share/ImportDialog";

export function Sidebar() {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const saving = usePlaybook((s) => s.saving);
  const logo = useMediaUrl(pb.team.logo);
  const maps = orderedMaps(pb, true);

  const link = (to: string, icon: React.ReactNode, label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
      {icon}
      {label}
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-team">
        <div className="logo">{logo ? <img src={logo} alt="" /> : (pb.team.tag || pb.team.name).slice(0, 2).toUpperCase()}</div>
        <div className="grow">
          <div className="name ellipsis">{pb.team.name}</div>
          <div className="sub">{t("app.name")}</div>
        </div>
      </div>
      <nav>
        {link("/", <Home size={17} />, t("nav.home"), true)}
        <div className="nav-section">{t("nav.maps")}</div>
        {maps.map(({ def }) => (
          <NavLink key={def.id} to={`/map/${def.id}`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <img className="map-icon" src={mapIconUrl(def.id)} alt="" />
            {def.name}
            <span className="count">{pb.tactics.filter((x) => x.mapId === def.id).length || ""}</span>
          </NavLink>
        ))}
        <div className="nav-section">{t("nav.planning")}</div>
        {link("/lineups", <Crosshair size={17} />, t("nav.lineups"))}
        {link("/roster", <Users size={17} />, t("nav.roster"))}
        {link("/pool", <Swords size={17} />, t("nav.pool"))}
        {link("/rounds", <ListChecks size={17} />, t("nav.rounds"))}
        {link("/settings", <Settings size={17} />, t("nav.settings"))}
      </nav>
      <div className="sidebar-footer">
        <div className="row">
          <button className="btn sm" onClick={pickAndImport} title={t("import.hint")}>
            <FileUp size={14} /> {t("import.button")}
          </button>
          <button className="btn sm" onClick={() => openExportDialog({ all: true })} title={t("export.hint")}>
            <FileDown size={14} /> {t("export.button")}
          </button>
        </div>
        <div className="version">
          <Shield size={10} style={{ verticalAlign: -1 }} /> v{__APP_VERSION__} · {saving ? t("app.saving") : t("app.saved")}
        </div>
      </div>
    </aside>
  );
}
