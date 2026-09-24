import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { newRoleAssignment } from "../model/factory";
import type { Side } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";
import { PlayerAvatar } from "./PlayerAvatar";

/** Default 5-man role lineup for a side, globally ("default") or as a per-map override. */
export function RoleAssignmentEditor({ mapId, side }: { mapId: string; side: Side }) {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const own = pb.roleAssignments.find((r) => r.mapId === mapId && r.side === side);
  const fallback = pb.roleAssignments.find((r) => r.mapId === "default" && r.side === side);
  const ra = own ?? fallback;
  const isOverride = mapId !== "default";
  const inherited = isOverride && !own;
  const roles = pb.roles.filter((r) => r.side === "both" || r.side === side);

  const upd = (fn: (slots: { roleId: string | null; playerId: string | null }[]) => void) =>
    updatePb((d) => {
      let target = d.roleAssignments.find((r) => r.mapId === mapId && r.side === side);
      if (!target) {
        target = { ...newRoleAssignment(mapId, side), slots: structuredClone(fallback?.slots ?? newRoleAssignment(mapId, side).slots) };
        d.roleAssignments.push(target);
      }
      fn(target.slots);
    });

  return (
    <div className="card pad">
      <div className="section-title">
        <span className={`badge ${side.toLowerCase()}`}>{side === "T" ? t("common.tSide") : t("common.ctSide")}</span>
        <h3>{isOverride ? t("roles.mapLineup") : t("roles.defaultLineup")}</h3>
        {inherited && <span className="muted small">{t("roles.usingDefault")}</span>}
        <div className="spacer" />
        {inherited && (
          <button className="btn sm" onClick={() => upd(() => {})}>
            <SlidersHorizontal size={14} /> {t("roles.customize")}
          </button>
        )}
        {isOverride && own && (
          <button
            className="btn sm ghost"
            onClick={() => updatePb((d) => void (d.roleAssignments = d.roleAssignments.filter((r) => !(r.mapId === mapId && r.side === side))))}
          >
            <RotateCcw size={14} /> {t("roles.resetToDefault")}
          </button>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 10, opacity: inherited ? 0.6 : 1 }}>
        {(ra?.slots ?? []).map((slot, i) => {
          const player = pb.players.find((p) => p.id === slot.playerId);
          const role = pb.roles.find((r) => r.id === slot.roleId);
          return (
            <div key={i} className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: "var(--panel-2)", borderTop: `3px solid ${role?.color ?? "var(--border-2)"}` }}>
              <select
                className="select sm"
                value={slot.roleId ?? ""}
                disabled={inherited}
                onChange={(e) => upd((s) => void (s[i].roleId = e.target.value || null))}
              >
                <option value="">{t("roles.noRole")}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="row">
                <PlayerAvatar player={player} size={28} fallback="?" />
                <select
                  className="select sm grow"
                  value={slot.playerId ?? ""}
                  disabled={inherited}
                  onChange={(e) => upd((s) => void (s[i].playerId = e.target.value || null))}
                >
                  <option value="">{t("editor.noPlayer")}</option>
                  {pb.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
