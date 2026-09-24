import { Crosshair, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { equipmentIconUrl, UTILITY_KINDS } from "../data/equipment";
import { getMap } from "../data/maps";
import { useSize } from "../lib/hooks";
import { isVideo, useMediaUrl } from "../lib/media";
import { newLineup } from "../model/factory";
import { getCallouts } from "../model/selectors";
import type { Lineup, LevelId, Side, UtilityKind, UtilityObj } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";
import { useSettings } from "../store/settings";
import { Board, DEFAULT_VIEW, type View } from "./board/Board";
import { utilityIcon } from "./board/objects";
import { Empty, Segmented, SideBadge } from "./ui";

export function lineupToObj(l: Lineup): UtilityObj {
  return { id: l.id, kind: "utility", level: l.level, util: l.util, x: l.landPos.x, y: l.landPos.y, from: l.throwPos, slotId: null, lineupId: l.id, note: "" };
}

export function LineupsView({ mapId }: { mapId: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const settings = useSettings();
  const def = getMap(mapId);
  const [utils, setUtils] = useState<Set<UtilityKind>>(new Set(UTILITY_KINDS));
  const [side, setSide] = useState<"all" | Side>("all");
  const [level, setLevel] = useState<LevelId>("default");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [wrapRef, size] = useSize<HTMLDivElement>();

  const lineups = useMemo(
    () =>
      pb.lineups
        .filter((l) => l.mapId === mapId && utils.has(l.util))
        .filter((l) => side === "all" || l.side === side || l.side === "both")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [pb.lineups, mapId, utils, side],
  );
  const objects = useMemo(() => lineups.map(lineupToObj), [lineups]);
  const sel = lineups.find((l) => l.id === selected);

  const create = () => {
    const l = { ...newLineup(mapId), level, side: side === "all" ? ("T" as const) : side };
    updatePb((d) => void d.lineups.push(l));
    nav(`/lineup/${l.id}`);
  };

  const toggleUtil = (u: UtilityKind) =>
    setUtils((s) => {
      const n = new Set(s);
      if (n.has(u)) n.delete(u);
      else n.add(u);
      return n.size ? n : new Set(UTILITY_KINDS);
    });

  return (
    <>
      <div className="filters">
        <Segmented
          size="sm"
          value={side}
          onChange={setSide}
          options={[
            { value: "all", label: t("common.all") },
            { value: "T", label: "T", className: "t" },
            { value: "CT", label: "CT", className: "ct" },
          ]}
        />
        <div className="row" style={{ gap: 4 }}>
          {UTILITY_KINDS.map((u) => (
            <button key={u} className={`equip ${utils.has(u) ? "on" : ""}`} onClick={() => toggleUtil(u)}>
              <img src={equipmentIconUrl(utilityIcon(u, side === "CT" ? "CT" : "T"))} alt="" /> {t(`util.${u}`)}
            </button>
          ))}
        </div>
        {def && def.levels.length > 1 && (
          <Segmented<LevelId> size="sm" value={level} onChange={setLevel} options={def.levels.map((l) => ({ value: l.id, label: t(`levels.${l.id}`) }))} />
        )}
        <div className="spacer" />
        <button className="btn primary" onClick={create}>
          <Plus size={15} /> {t("lineups.new")}
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 16, alignItems: "start" }}>
        <div ref={wrapRef} className="card board-wrap" style={{ aspectRatio: "1", maxHeight: "calc(100vh - 250px)" }}>
          {size.width > 0 && (
            <Board
              mapId={mapId}
              level={level}
              side={side === "CT" ? "CT" : "T"}
              objects={objects}
              slots={[]}
              players={pb.players}
              width={size.width}
              height={size.height}
              callouts={settings.showCallouts ? getCallouts(pb, mapId) : null}
              tokenStyle={settings.tokenStyle}
              tokenScale={1}
              view={view}
              onViewChange={setView}
              interaction={{
                editable: false,
                objectsListen: true,
                selectedIds: new Set(selected ? [selected] : []),
                panOnBackground: true,
                cursor: "pointer",
                onBackgroundDown: () => setSelected(null),
                onObjectDown: (id) => setSelected(id),
                onObjectDblClick: (id) => nav(`/lineup/${id}`),
              }}
            />
          )}
        </div>

        <div className="col" style={{ gap: 10 }}>
          {sel ? (
            <LineupDetails lineup={sel} onEdit={() => nav(`/lineup/${sel.id}`)} onClose={() => setSelected(null)} />
          ) : lineups.length === 0 ? (
            <Empty icon={<Crosshair size={30} />} title={t("lineups.none")} text={t("lineups.noneText")} />
          ) : (
            <div className="card" style={{ maxHeight: "calc(100vh - 250px)", overflow: "auto" }}>
              {lineups.map((l) => (
                <div
                  key={l.id}
                  className="row"
                  style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => {
                    setSelected(l.id);
                    setLevel(l.level);
                  }}
                >
                  <img src={equipmentIconUrl(utilityIcon(l.util, l.side === "CT" ? "CT" : "T"))} alt="" style={{ height: 18, width: 22, objectFit: "contain" }} />
                  <span className="grow ellipsis">{l.name || t("lineups.unnamed")}</span>
                  <SideBadge side={l.side} />
                  <span className="muted small">{t(`technique.${l.technique}`)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MediaThumb({ id }: { id: string }) {
  const url = useMediaUrl(id);
  const [open, setOpen] = useState(false);
  if (!url) return <div className="m" />;
  return (
    <>
      <div className="m" onClick={() => setOpen(true)}>
        {isVideo(id) ? <video src={url} muted /> : <img src={url} alt="" />}
      </div>
      {open && (
        <div className="viewer" onClick={() => setOpen(false)}>
          {isVideo(id) ? <video src={url} controls autoPlay onClick={(e) => e.stopPropagation()} /> : <img src={url} alt="" />}
        </div>
      )}
    </>
  );
}

export function LineupDetails({ lineup: l, onEdit, onClose }: { lineup: Lineup; onEdit?: () => void; onClose?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="card pad col" style={{ gap: 10 }}>
      <div className="row">
        <img src={equipmentIconUrl(utilityIcon(l.util, l.side === "CT" ? "CT" : "T"))} alt="" style={{ height: 22 }} />
        <h3 className="grow">{l.name || t("lineups.unnamed")}</h3>
        {onEdit && (
          <button className="btn sm" onClick={onEdit}>
            <Pencil size={14} /> {t("common.edit")}
          </button>
        )}
        {onClose && (
          <button className="btn sm ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        )}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <SideBadge side={l.side} />
        <span className="badge">{t(`util.${l.util}`)}</span>
        <span className="badge accent">{t(`technique.${l.technique}`)}</span>
        {l.tags.map((tg) => (
          <span key={tg} className="tag">
            {tg}
          </span>
        ))}
      </div>
      {l.description && <div style={{ whiteSpace: "pre-wrap", color: "var(--text-2)" }}>{l.description}</div>}
      {l.setpos && <code className="mono small muted" style={{ userSelect: "text", wordBreak: "break-all" }}>{l.setpos}</code>}
      {l.media.length > 0 && (
        <div className="lineup-media">
          {l.media.map((m) => (
            <MediaThumb key={m} id={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export { MediaThumb };
