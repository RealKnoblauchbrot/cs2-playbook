import { useTranslation } from "react-i18next";
import { equipmentIconUrl } from "../../data/equipment";
import type { Player, Step, Tactic } from "../../model/types";
import { utilityIcon } from "../board/objects";
import { PlayerAvatar } from "../PlayerAvatar";

/** Per-player instruction table like the team's PDF pages. */
export function PresentTable({ tactic, step, players }: { tactic: Tactic; step: Step; players: Player[] }) {
  const { t } = useTranslation();
  return (
    <div className="present-table">
      {tactic.slots.map((slot, i) => {
        const pl = players.find((p) => p.id === slot.playerId);
        const utils = step.objects.filter((o) => o.kind === "utility" && o.slotId === slot.id);
        return (
          <div key={slot.id} className="cell">
            <div className="who">
              <PlayerAvatar player={pl} size={28} fallback={`P${i + 1}`} />
              <span className="ellipsis">{pl?.name ?? `P${i + 1}`}</span>
              {slot.role && <span className="badge">{slot.role}</span>}
            </div>
            {utils.length > 0 && (
              <div className="equip-list" style={{ marginBottom: 4 }}>
                {utils.map(
                  (u) =>
                    u.kind === "utility" && (
                      <span key={u.id} className="row small" style={{ gap: 4 }} title={u.note}>
                        <img src={equipmentIconUrl(utilityIcon(u.util, tactic.side))} alt="" />
                        {u.note && <span className="muted">{u.note}</span>}
                      </span>
                    ),
                )}
              </div>
            )}
            <div className="what">{slot.notes || <span className="muted">{t("editor.noNotes")}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}
