import {
  ArrowUpRight,
  Circle,
  Eraser,
  Eye,
  MapPin,
  MousePointer2,
  PenLine,
  Slash,
  Square,
  Type,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { equipmentIconUrl } from "../../data/equipment";
import type { Side } from "../../model/types";
import { utilityIcon } from "../board/objects";
import { TOOL_KEYS, UTILITY_TOOLS, type Tool } from "../board/tools";

export function Toolbar(props: { tool: Tool; side: Side; onTool: (t: Tool) => void }) {
  const { t } = useTranslation();
  const btn = (tool: Tool, icon: ReactNode) => (
    <button
      key={tool}
      className={`tool ${props.tool === tool ? "on" : ""}`}
      title={`${t(`tools.${tool}`)}${TOOL_KEYS[tool] ? ` (${TOOL_KEYS[tool]})` : ""}`}
      onClick={() => props.onTool(tool)}
    >
      {icon}
      {TOOL_KEYS[tool] && <span className="key">{TOOL_KEYS[tool]}</span>}
    </button>
  );
  return (
    <div className="toolbar">
      {btn("select", <MousePointer2 size={19} />)}
      {btn("player", <UserRound size={19} />)}
      {btn("enemy", <X size={19} color="#ef5350" />)}
      <div className="sep" />
      {UTILITY_TOOLS.map((u) => btn(u, <img src={equipmentIconUrl(utilityIcon(u, props.side))} alt="" />))}
      <div className="sep" />
      {btn("arrow", <ArrowUpRight size={19} />)}
      {btn("line", <Slash size={19} />)}
      {btn("draw", <PenLine size={19} />)}
      {btn("zone-rect", <Square size={19} />)}
      {btn("zone-circle", <Circle size={19} />)}
      {btn("vision", <Eye size={19} />)}
      {btn("text", <Type size={19} />)}
      {btn("icon", <MapPin size={19} />)}
      <div className="sep" />
      {btn("eraser", <Eraser size={19} />)}
    </div>
  );
}
