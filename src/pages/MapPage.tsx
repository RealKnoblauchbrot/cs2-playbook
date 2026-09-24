import { Crosshair, Plus, Search, Star, Swords, Tags, Users, NotebookPen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalloutEditor } from "../components/CalloutEditor";
import { TACTIC_TYPES } from "../components/editor/SidePanel";
import { LineupsView } from "../components/LineupsView";
import { RoleAssignmentEditor } from "../components/RoleAssignmentEditor";
import { TacticCard } from "../components/TacticCard";
import { Empty, Field, Modal, Segmented, Stars, Tabs } from "../components/ui";
import { getMap, mapIconUrl } from "../data/maps";
import { newTactic } from "../model/factory";
import type { PoolStatus, Side, TacticType } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";

type Tab = "tactics" | "lineups" | "roles" | "callouts" | "notes";

export default function MapPage() {
  const { mapId = "" } = useParams();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "tactics";
  const pb = usePlaybook((s) => s.pb)!;
  const def = getMap(mapId);
  const data = pb.maps.find((m) => m.id === mapId);
  if (!def || !data) return <div className="page"><Empty title={t("map.notFound")} /></div>;

  const setData = (patch: Partial<typeof data>, coalesce?: string) =>
    updatePb((d) => {
      const m = d.maps.find((x) => x.id === mapId);
      if (m) Object.assign(m, patch);
    }, { coalesce });

  return (
    <div className="page">
      <div className="page-header">
        <div className="map-hero">
          <img src={mapIconUrl(mapId)} alt="" />
          <div>
            <h1>{def.name}</h1>
            <div className="row small muted" style={{ gap: 10 }}>
              <span>{t("map.tacticCount", { count: pb.tactics.filter((x) => x.mapId === mapId).length })}</span>
              <Stars value={data.comfort} size={13} onChange={(v) => setData({ comfort: v })} />
            </div>
          </div>
        </div>
        <div className="spacer" />
        <select className="select sm" style={{ width: 150 }} value={data.status} onChange={(e) => setData({ status: e.target.value as PoolStatus })}>
          {(["pick", "neutral", "ban", "permaban"] as PoolStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(`pool.status.${s}`)}
            </option>
          ))}
        </select>
        <label className="checkbox small">
          <input type="checkbox" checked={data.inPool} onChange={(e) => setData({ inPool: e.target.checked })} /> {t("pool.inPool")}
        </label>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { value: "tactics", label: <><Swords size={15} /> {t("map.tab.tactics")}</> },
          { value: "lineups", label: <><Crosshair size={15} /> {t("map.tab.lineups")}</> },
          { value: "roles", label: <><Users size={15} /> {t("map.tab.roles")}</> },
          { value: "callouts", label: <><Tags size={15} /> {t("map.tab.callouts")}</> },
          { value: "notes", label: <><NotebookPen size={15} /> {t("map.tab.notes")}</> },
        ]}
      />

      {tab === "tactics" && <TacticsTab mapId={mapId} />}
      {tab === "lineups" && <LineupsView mapId={mapId} />}
      {tab === "roles" && (
        <div className="col" style={{ gap: 18 }}>
          <p className="muted" style={{ margin: 0 }}>{t("map.rolesHint")}</p>
          <RoleAssignmentEditor mapId={mapId} side="T" />
          <RoleAssignmentEditor mapId={mapId} side="CT" />
        </div>
      )}
      {tab === "callouts" && <CalloutEditor mapId={mapId} />}
      {tab === "notes" && (
        <textarea
          className="textarea"
          style={{ minHeight: 360 }}
          placeholder={t("map.notesPh")}
          value={data.notes}
          onChange={(e) => setData({ notes: e.target.value }, `mapnotes-${mapId}`)}
        />
      )}
    </div>
  );
}

function TacticsTab({ mapId }: { mapId: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const [side, setSide] = useState<"all" | Side>("all");
  const [type, setType] = useState<"" | TacticType>("");
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [creating, setCreating] = useState(false);

  const query = q.trim().toLowerCase();
  const list = pb.tactics
    .filter((x) => x.mapId === mapId)
    .filter((x) => side === "all" || x.side === side)
    .filter((x) => !type || x.type === type)
    .filter((x) => !favOnly || x.favorite)
    .filter(
      (x) =>
        !query ||
        x.name.toLowerCase().includes(query) ||
        x.tags.some((tg) => tg.toLowerCase().includes(query)) ||
        x.description.toLowerCase().includes(query),
    )
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  const sections: { side: Side; items: typeof list }[] = (["T", "CT"] as Side[])
    .filter((s) => side === "all" || s === side)
    .map((s) => ({ side: s, items: list.filter((x) => x.side === s) }));

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
        <select className="select sm" value={type} onChange={(e) => setType(e.target.value as TacticType | "")}>
          <option value="">{t("map.allTypes")}</option>
          {TACTIC_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`tacticType.${ty}`)}
            </option>
          ))}
        </select>
        <div className="row" style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 9, color: "var(--muted)" }} />
          <input className="input sm" style={{ paddingLeft: 28 }} placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={`btn sm ${favOnly ? "active" : ""}`} onClick={() => setFavOnly(!favOnly)}>
          <Star size={14} /> {t("tactic.favorites")}
        </button>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> {t("tactic.new")}
        </button>
      </div>

      {pb.tactics.every((x) => x.mapId !== mapId) ? (
        <Empty
          icon={<Swords size={34} />}
          title={t("map.noTactics")}
          text={t("map.noTacticsText")}
          action={
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> {t("tactic.new")}
            </button>
          }
        />
      ) : (
        sections.map((s) => (
          <div key={s.side} className="section" style={{ marginTop: 10, marginBottom: 20 }}>
            <div className="section-title">
              <span className={`badge ${s.side.toLowerCase()}`}>{s.side === "T" ? t("common.tSide") : t("common.ctSide")}</span>
              <span className="muted small">{s.items.length}</span>
            </div>
            {s.items.length ? (
              <div className="grid tactics">
                {s.items.map((x) => (
                  <TacticCard key={x.id} tactic={x} />
                ))}
              </div>
            ) : (
              <div className="muted small">{t("map.noneFiltered")}</div>
            )}
          </div>
        ))
      )}

      {creating && (
        <NewTacticDialog
          defaultSide={side === "all" ? "T" : side}
          onClose={() => setCreating(false)}
          onCreate={(name, sd, ty) => {
            const tac = { ...newTactic(mapId, sd, pb.players, name), type: ty };
            updatePb((d) => void d.tactics.push(tac));
            nav(`/tactic/${tac.id}`);
          }}
        />
      )}
    </>
  );
}

function NewTacticDialog(props: { defaultSide: Side; onClose(): void; onCreate(name: string, side: Side, type: TacticType): void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [side, setSide] = useState<Side>(props.defaultSide);
  const [type, setType] = useState<TacticType>(props.defaultSide === "T" ? "execute" : "setup");
  const ok = () => props.onCreate(name.trim() || t("tactic.untitled"), side, type);
  return (
    <Modal
      title={t("tactic.new")}
      onClose={props.onClose}
      footer={
        <>
          <button className="btn ghost" onClick={props.onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" onClick={ok}>
            {t("common.create")}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 12 }}>
        <Field label={t("tactic.name")}>
          <input className="input" autoFocus value={name} placeholder={t("tactic.namePh")} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} />
        </Field>
        <div className="row" style={{ gap: 14, alignItems: "flex-end" }}>
          <Field label={t("tactic.side")}>
            <Segmented<Side>
              value={side}
              onChange={(v) => {
                setSide(v);
                setType(v === "T" ? "execute" : "setup");
              }}
              options={[
                { value: "T", label: t("common.tSide"), className: "t" },
                { value: "CT", label: t("common.ctSide"), className: "ct" },
              ]}
            />
          </Field>
          <Field label={t("tactic.type")} style={{ flex: 1 }}>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as TacticType)}>
              {TACTIC_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`tacticType.${ty}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
