import { GripVertical, Plus, Swords } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Empty, Stars } from "../components/ui";
import { mapIconUrl, mapName } from "../data/maps";
import { newVeto } from "../model/factory";
import { orderedMaps } from "../model/selectors";
import type { PoolStatus } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";

export default function PoolPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const maps = orderedMaps(pb);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const setMap = (id: string, patch: Record<string, unknown>, coalesce?: string) =>
    updatePb((d) => {
      const m = d.maps.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    }, { coalesce });

  const reorder = (from: string, to: string) =>
    updatePb((d) => {
      const order = [...d.maps].sort((a, b) => a.priority - b.priority).map((m) => m.id);
      order.splice(order.indexOf(to), 0, order.splice(order.indexOf(from), 1)[0]);
      d.maps.forEach((m) => (m.priority = order.indexOf(m.id)));
    });

  const create = () => {
    const v = newVeto();
    updatePb((d) => void d.vetos.push(v));
    nav(`/veto/${v.id}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("nav.pool")}</h1>
      </div>

      <div className="section-title">
        <h2>{t("pool.title")}</h2>
        <span className="muted small">{t("pool.hint")}</span>
      </div>
      <div className="card">
        {maps.map(({ def, data }) => (
          <div
            key={def.id}
            className={`pool-row ${over === def.id ? "over" : ""}`}
            draggable
            onDragStart={() => setDrag(def.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(def.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              if (drag && drag !== def.id) reorder(drag, def.id);
              setDrag(null);
              setOver(null);
            }}
            style={{ opacity: data.inPool ? 1 : 0.5 }}
          >
            <span className="drag">
              <GripVertical size={16} />
            </span>
            <img src={mapIconUrl(def.id)} alt="" />
            <div className="row">
              <label className="checkbox" title={t("pool.inPool")}>
                <input type="checkbox" checked={data.inPool} onChange={(e) => setMap(def.id, { inPool: e.target.checked })} />
              </label>
              <b>{def.name}</b>
            </div>
            <select className="select sm" value={data.status} onChange={(e) => setMap(def.id, { status: e.target.value as PoolStatus })}>
              {(["pick", "neutral", "ban", "permaban"] as PoolStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`pool.status.${s}`)}
                </option>
              ))}
            </select>
            <Stars value={data.comfort} onChange={(v) => setMap(def.id, { comfort: v })} />
            <input
              className="input sm"
              placeholder={t("pool.notesPh")}
              value={data.poolNote}
              onChange={(e) => setMap(def.id, { poolNote: e.target.value }, `pnotes-${def.id}`)}
            />
            <span className="muted small" title={t("pool.tacticCount")}>
              {pb.tactics.filter((x) => x.mapId === def.id).length}
            </span>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t("veto.title")}</h2>
          <div className="spacer" />
          <button className="btn primary" onClick={create}>
            <Plus size={15} /> {t("veto.new")}
          </button>
        </div>
        {pb.vetos.length === 0 ? (
          <Empty icon={<Swords size={30} />} title={t("veto.none")} text={t("veto.noneText")} />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {[...pb.vetos]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((v) => {
                const played = v.steps.filter((s) => (s.action === "pick" || s.action === "decider") && s.mapId);
                return (
                  <div key={v.id} className="card pad hover" onClick={() => nav(`/veto/${v.id}`)}>
                    <div className="row">
                      <b className="grow ellipsis">{v.name || t("veto.untitled")}</b>
                      <span className="badge">{v.format.toUpperCase()}</span>
                    </div>
                    <div className="muted small">{v.opponent ? t("veto.vs", { opponent: v.opponent }) : " "}</div>
                    <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                      {played.map((s, i) => (
                        <span key={i} className="badge accent">
                          {mapName(s.mapId!)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
