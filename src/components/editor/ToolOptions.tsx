import { useTranslation } from "react-i18next";
import type { ID, MarkerIcon, Player, TacticSlot } from "../../model/types";
import { PlayerAvatar } from "../PlayerAvatar";
import { isUtilityTool, MARKER_ICONS, type Tool } from "../board/tools";
import { ColorPicker } from "../ui";
import type { ToolStyle } from "./useBoardTools";

const COLOR_TOOLS: Tool[] = ["arrow", "line", "draw", "zone-rect", "zone-circle", "vision"];

export function ToolOptions(props: {
  tool: Tool;
  style: ToolStyle;
  onStyle(s: Partial<ToolStyle>): void;
  slots: TacticSlot[];
  players: Player[];
  armedSlot: ID | null;
  onArm(id: ID | null): void;
}) {
  const { t } = useTranslation();
  const { tool, style } = props;
  const showSlots = tool === "player" || ((isUtilityTool(tool) || tool === "vision") && style.assignThrower);
  const hint = t(`toolHints.${tool}`, { defaultValue: "" });

  return (
    <div className="col" style={{ gap: 6, alignItems: "flex-start" }}>
      {(showSlots || COLOR_TOOLS.includes(tool) || tool === "icon" || isUtilityTool(tool)) && (
        <div className="glass" style={{ padding: "6px 8px", gap: 10, flexWrap: "wrap", maxWidth: 640 }}>
          {showSlots && (
            <div className="row" style={{ gap: 5 }}>
              {props.slots.map((s, i) => {
                const pl = props.players.find((x) => x.id === s.playerId);
                const on = props.armedSlot === s.id;
                return (
                  <button
                    key={s.id}
                    title={`${pl?.name ?? `P${i + 1}`} (${i + 1})`}
                    onClick={() => props.onArm(on && tool !== "player" ? null : s.id)}
                    style={{
                      border: 0,
                      padding: 2,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: on ? "var(--accent)" : "transparent",
                    }}
                  >
                    <PlayerAvatar player={pl} size={26} fallback={`P${i + 1}`} ring={false} />
                  </button>
                );
              })}
            </div>
          )}
          {(isUtilityTool(tool) || tool === "vision") && (
            <label className="checkbox small">
              <input type="checkbox" checked={style.assignThrower} onChange={(e) => props.onStyle({ assignThrower: e.target.checked })} />
              {t("editor.assignToPlayer")}
            </label>
          )}
          {COLOR_TOOLS.includes(tool) && <ColorPicker value={style.color} onChange={(c) => props.onStyle({ color: c })} />}
          {(tool === "arrow" || tool === "line" || tool === "draw") && (
            <input
              type="range"
              min={1}
              max={12}
              value={style.width}
              title={t("editor.width")}
              style={{ width: 80 }}
              onChange={(e) => props.onStyle({ width: Number(e.target.value) })}
            />
          )}
          {(tool === "arrow" || tool === "line") && (
            <label className="checkbox small">
              <input type="checkbox" checked={style.dashed} onChange={(e) => props.onStyle({ dashed: e.target.checked })} />
              {t("editor.dashed")}
            </label>
          )}
          {tool === "arrow" && (
            <label className="checkbox small">
              <input type="checkbox" checked={style.curved} onChange={(e) => props.onStyle({ curved: e.target.checked })} />
              {t("editor.curved")}
            </label>
          )}
          {tool === "icon" && (
            <select className="select sm" style={{ width: 150 }} value={style.icon} onChange={(e) => props.onStyle({ icon: e.target.value as MarkerIcon })}>
              {MARKER_ICONS.map((i) => (
                <option key={i} value={i}>
                  {t(`icons.${i}`)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {hint && <div className="glass hint">{hint}</div>}
    </div>
  );
}
