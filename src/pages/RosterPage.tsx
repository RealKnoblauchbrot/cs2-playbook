import type { Draft } from "immer";
import { ImagePlus, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RoleAssignmentEditor } from "../components/RoleAssignmentEditor";
import { ColorPicker, confirmDialog, Field } from "../components/ui";
import { IMAGE_ACCEPT, pickFiles, putMediaFile, useMediaUrl } from "../lib/media";
import { newId, newPlayer, PLAYER_COLORS } from "../model/factory";
import type { MediaID, Player, PlayerStatus, RoleDef } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";

function PhotoBox(props: { id: MediaID | null; label: string; round?: boolean; onSet(id: MediaID | null): void }) {
  const url = useMediaUrl(props.id);
  const [over, setOver] = useState(false);
  const pick = async () => {
    const [f] = await pickFiles(IMAGE_ACCEPT);
    if (f) props.onSet(await putMediaFile(f));
  };
  return (
    <div
      className={`photo-drop ${props.round ? "round" : ""}`}
      style={over ? { borderColor: "var(--accent)" } : undefined}
      onClick={pick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
        if (f) props.onSet(await putMediaFile(f));
      }}
      title={props.label}
    >
      {url ? <img src={url} alt="" /> : <ImagePlus size={20} />}
      <span className="lbl">{props.label}</span>
      {url && (
        <button
          className="btn icon sm"
          style={{ position: "absolute", top: 2, right: 2, width: 22, height: 22 }}
          onClick={(e) => {
            e.stopPropagation();
            props.onSet(null);
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export default function RosterPage() {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const logo = useMediaUrl(pb.team.logo);

  const updPlayer = (id: string, fn: (p: Draft<Player>) => void, coalesce?: string) =>
    updatePb(
      (d) => {
        const p = d.players.find((x) => x.id === id);
        if (!p) return;
        fn(p);
        p.updatedAt = Date.now();
      },
      { coalesce },
    );
  const updRole = (id: string, fn: (r: Draft<RoleDef>) => void, coalesce?: string) =>
    updatePb((d) => {
      const r = d.roles.find((x) => x.id === id);
      if (r) fn(r);
    }, { coalesce });

  const removePlayer = async (p: Player) => {
    if (!(await confirmDialog({ title: t("roster.deleteConfirm", { name: p.name }), text: t("roster.deleteText"), danger: true, okLabel: t("common.delete") }))) return;
    updatePb((d) => {
      d.players = d.players.filter((x) => x.id !== p.id);
      for (const tac of d.tactics) for (const s of tac.slots) if (s.playerId === p.id) s.playerId = null;
      for (const ra of d.roleAssignments) for (const s of ra.slots) if (s.playerId === p.id) s.playerId = null;
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("nav.roster")}</h1>
      </div>

      <div className="card pad row" style={{ gap: 18, alignItems: "flex-start" }}>
        <div
          className="photo-drop"
          style={{ width: 84, height: 84 }}
          onClick={async () => {
            const [f] = await pickFiles(IMAGE_ACCEPT);
            if (f) {
              const id = await putMediaFile(f);
              updatePb((d) => void (d.team.logo = id));
            }
          }}
        >
          {logo ? <img src={logo} alt="" /> : <ImagePlus size={20} />}
          <span className="lbl">{t("roster.logo")}</span>
        </div>
        <div className="form-grid grow">
          <Field label={t("roster.teamName")}>
            <input className="input" value={pb.team.name} onChange={(e) => updatePb((d) => void (d.team.name = e.target.value), { coalesce: "teamname" })} />
          </Field>
          <Field label={t("roster.teamTag")}>
            <input className="input" value={pb.team.tag} maxLength={6} onChange={(e) => updatePb((d) => void (d.team.tag = e.target.value), { coalesce: "teamtag" })} />
          </Field>
          <Field label={t("roster.accent")}>
            <ColorPicker value={pb.team.accent} colors={["#29b6f6", "#ffca28", "#ef5350", "#66bb6a", "#ab47bc", "#ff8a65", "#26c6da"]} onChange={(c) => updatePb((d) => void (d.team.accent = c))} />
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t("roster.players")}</h2>
          <span className="muted small">{t("roster.photoHint")}</span>
          <div className="spacer" />
          <button className="btn primary" onClick={() => updatePb((d) => void d.players.push(newPlayer(t("roster.newPlayer"), d.players.length)))}>
            <UserPlus size={15} /> {t("roster.addPlayer")}
          </button>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))" }}>
          {pb.players.map((p) => (
            <div key={p.id} className="card player-card" style={{ borderTop: `3px solid ${p.color}` }}>
              <PhotoBox id={p.cutout} label={t("roster.cutout")} onSet={(id) => updPlayer(p.id, (x) => void (x.cutout = id))} />
              <PhotoBox id={p.avatar} label={t("roster.avatar")} round onSet={(id) => updPlayer(p.id, (x) => void (x.avatar = id))} />
              <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
                <div className="row">
                  <input className="input sm grow" style={{ fontWeight: 650 }} value={p.name} onChange={(e) => updPlayer(p.id, (x) => void (x.name = e.target.value), `pname-${p.id}`)} />
                  <select className="select sm" style={{ width: 100 }} value={p.status} onChange={(e) => updPlayer(p.id, (x) => void (x.status = e.target.value as PlayerStatus))}>
                    {(["main", "sub", "coach"] as PlayerStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {t(`roster.status.${s}`)}
                      </option>
                    ))}
                  </select>
                  <button className="btn icon sm ghost" onClick={() => removePlayer(p)} title={t("common.delete")}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <ColorPicker value={p.color} colors={PLAYER_COLORS} onChange={(c) => updPlayer(p.id, (x) => void (x.color = c))} />
                <textarea
                  className="textarea"
                  style={{ minHeight: 48 }}
                  placeholder={t("roster.notesPh")}
                  value={p.notes}
                  onChange={(e) => updPlayer(p.id, (x) => void (x.notes = e.target.value), `pnotes-${p.id}`)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t("roles.defaultRoles")}</h2>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <RoleAssignmentEditor mapId="default" side="T" />
          <RoleAssignmentEditor mapId="default" side="CT" />
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t("roles.title")}</h2>
          <div className="spacer" />
          <button
            className="btn"
            onClick={() => updatePb((d) => void d.roles.push({ id: newId(), name: t("roles.newRole"), side: "both", color: "#90a4ae", description: "" }))}
          >
            <Plus size={15} /> {t("roles.add")}
          </button>
        </div>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>{t("roles.name")}</th>
                <th style={{ width: 120 }}>{t("roles.side")}</th>
                <th>{t("roles.description")}</th>
                <th style={{ width: 230 }}>{t("editor.color")}</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {pb.roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input className="input sm" value={r.name} onChange={(e) => updRole(r.id, (x) => void (x.name = e.target.value), `rname-${r.id}`)} />
                  </td>
                  <td>
                    <select className="select sm" value={r.side} onChange={(e) => updRole(r.id, (x) => void (x.side = e.target.value as RoleDef["side"]))}>
                      <option value="both">{t("common.both")}</option>
                      <option value="T">T</option>
                      <option value="CT">CT</option>
                    </select>
                  </td>
                  <td>
                    <input className="input sm" value={r.description} onChange={(e) => updRole(r.id, (x) => void (x.description = e.target.value), `rdesc-${r.id}`)} />
                  </td>
                  <td>
                    <ColorPicker value={r.color} colors={["#ef5350", "#ff8a65", "#66bb6a", "#29b6f6", "#ffca28", "#ab47bc", "#26c6da", "#90a4ae"]} onChange={(c) => updRole(r.id, (x) => void (x.color = c))} />
                  </td>
                  <td>
                    <button
                      className="btn icon sm ghost"
                      onClick={() =>
                        updatePb((d) => {
                          d.roles = d.roles.filter((x) => x.id !== r.id);
                          for (const ra of d.roleAssignments) for (const s of ra.slots) if (s.roleId === r.id) s.roleId = null;
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
