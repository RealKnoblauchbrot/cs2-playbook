import { useRef, useState } from "react";
import { clamp01, dist, pathLength, simplify } from "../../lib/geometry";
import { newId } from "../../model/factory";
import type { BoardObject, ID, LevelId, MarkerIcon, TacticSlot, UtilityObj } from "../../model/types";
import type { BoardInteraction } from "../board/Board";
import { isUtilityTool, type Pt, type Tool } from "../board/tools";

export interface ToolStyle {
  color: string;
  width: number;
  dashed: boolean;
  curved: boolean;
  icon: MarkerIcon;
  zoneOpacity: number;
  /** Assign utility/arrows to the armed player. */
  assignThrower: boolean;
}

export const DEFAULT_STYLE: ToolStyle = {
  color: "#ffffff",
  width: 4,
  dashed: false,
  curved: true,
  icon: "bomb",
  zoneOpacity: 0.28,
  assignThrower: true,
};

interface Options {
  tool: Tool;
  style: ToolStyle;
  level: LevelId;
  armedSlot: ID | null;
  slots: TacticSlot[];
  objects: BoardObject[];
  selected: Set<ID>;
  setSelected(ids: Set<ID>): void;
  add(o: BoardObject): void;
  change(id: ID, patch: Partial<BoardObject>): void;
  remove(ids: ID[]): void;
  onPlayerPlaced(slotId: ID): void;
  requestText(p: Pt): void;
  onObjectSelected(): void;
}

const pt = (p: Pt) => ({ x: clamp01(p.x), y: clamp01(p.y) });

export function useBoardTools(o: Options): BoardInteraction {
  const start = useRef<Pt | null>(null);
  const path = useRef<number[]>([]);
  const [draft, setDraft] = useState<BoardObject | null>(null);

  const build = (a: Pt, b: Pt, shift: boolean): BoardObject | null => {
    const base = { id: "draft", level: o.level };
    const { tool, style } = o;
    if (isUtilityTool(tool)) {
      const far = dist(a, b) > 0.012;
      return {
        ...base,
        kind: "utility",
        util: tool,
        x: b.x,
        y: b.y,
        from: far ? a : null,
        slotId: style.assignThrower ? o.armedSlot : null,
        lineupId: null,
        note: "",
      } satisfies UtilityObj;
    }
    switch (tool) {
      case "arrow":
      case "line":
      case "draw": {
        const pts = shift || tool === "line" ? [a.x, a.y, b.x, b.y] : path.current;
        if (tool === "draw") return { ...base, kind: "draw", points: pts, color: style.color, width: style.width };
        return {
          ...base,
          kind: "arrow",
          points: pts,
          color: style.color,
          width: style.width,
          dashed: style.dashed,
          head: tool === "arrow",
          curved: style.curved && !shift && tool === "arrow",
          slotId: null,
        };
      }
      case "zone-rect":
      case "zone-circle":
        return {
          ...base,
          kind: "zone",
          shape: tool === "zone-rect" ? "rect" : "circle",
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.abs(b.x - a.x),
          h: Math.abs(b.y - a.y),
          color: style.color,
          opacity: style.zoneOpacity,
          label: "",
        };
      case "vision":
        return {
          ...base,
          kind: "vision",
          x: a.x,
          y: a.y,
          angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
          spread: 50,
          length: Math.max(0.02, dist(a, b)),
          color: style.color,
          slotId: style.assignThrower ? o.armedSlot : null,
        };
    }
    return null;
  };

  const dragTools: Tool[] = ["arrow", "line", "draw", "zone-rect", "zone-circle", "vision"];
  const isDrag = (t: Tool) => dragTools.includes(t) || isUtilityTool(t);

  const finish = (obj: BoardObject | null) => {
    start.current = null;
    path.current = [];
    setDraft(null);
    if (obj) o.add({ ...obj, id: newId() } as BoardObject);
  };

  const objectsListen = o.tool === "select" || o.tool === "eraser";

  return {
    editable: o.tool === "select",
    objectsListen,
    selectedIds: o.selected,
    panOnBackground: o.tool === "select" || o.tool === "eraser",
    cursor: o.tool === "select" ? "default" : o.tool === "eraser" ? "not-allowed" : "crosshair",
    draft,

    onBackgroundDown() {
      if (o.selected.size) o.setSelected(new Set());
    },

    onObjectDown(id, e) {
      if (o.tool === "eraser") {
        o.remove([id]);
        return;
      }
      const additive = e.evt?.shiftKey || e.evt?.ctrlKey;
      if (additive) {
        const next = new Set(o.selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        o.setSelected(next);
      } else if (!o.selected.has(id)) {
        o.setSelected(new Set([id]));
      }
      o.onObjectSelected();
    },

    onObjectChange(id, patch) {
      o.change(id, patch);
    },

    onPointerDown(raw) {
      const p = pt(raw);
      const { tool } = o;
      if (tool === "player") {
        const slotId = o.armedSlot ?? o.slots.find((s) => !o.objects.some((x) => x.kind === "player" && x.slotId === s.id))?.id;
        if (!slotId) return;
        const existing = o.objects.find((x) => x.kind === "player" && x.slotId === slotId && x.level === o.level)
          ?? o.objects.find((x) => x.kind === "player" && x.slotId === slotId);
        if (existing) o.change(existing.id, { x: p.x, y: p.y, level: o.level });
        else o.add({ id: newId(), kind: "player", level: o.level, slotId, x: p.x, y: p.y, facing: null });
        o.onPlayerPlaced(slotId);
        return;
      }
      if (tool === "enemy") {
        o.add({ id: newId(), kind: "enemy", level: o.level, x: p.x, y: p.y, label: "" });
        return;
      }
      if (tool === "icon") {
        o.add({ id: newId(), kind: "icon", level: o.level, icon: o.style.icon, x: p.x, y: p.y, color: iconColor(o.style.icon) });
        return;
      }
      if (tool === "text") {
        o.requestText(p);
        return;
      }
      if (isDrag(tool)) {
        start.current = p;
        path.current = [p.x, p.y];
        setDraft(build(p, p, false));
      }
    },

    onPointerMove(raw, e) {
      if (!start.current) return;
      const p = pt(raw);
      const last = path.current.slice(-2);
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.003) path.current.push(p.x, p.y);
      setDraft(build(start.current, p, e.evt.shiftKey));
    },

    onPointerUp(raw, e) {
      if (!start.current) return;
      const p = pt(raw);
      const a = start.current;
      const { tool } = o;
      if (tool === "arrow" || tool === "line" || tool === "draw") {
        path.current.push(p.x, p.y);
        if (pathLength(path.current) < 0.015) return finish(null);
        if (tool !== "draw" && !e.evt.shiftKey) path.current = simplify(path.current, 0.006);
        if (tool === "draw") path.current = simplify(path.current, 0.0015);
        return finish(build(a, p, e.evt.shiftKey));
      }
      if (tool === "zone-rect" || tool === "zone-circle") {
        if (dist(a, p) < 0.01) return finish(null);
        return finish(build(a, p, false));
      }
      if (tool === "vision") {
        if (dist(a, p) < 0.01) return finish(null);
        return finish(build(a, p, false));
      }
      finish(build(a, p, false));
    },
  };
}

export function iconColor(icon: MarkerIcon): string {
  switch (icon) {
    case "bomb":
      return "#e53935";
    case "defuse":
      return "#1e88e5";
    case "awp":
      return "#43a047";
    case "warning":
      return "#fb8c00";
    case "star":
      return "#fdd835";
    case "x":
      return "#e53935";
    default:
      return "#546e7a";
  }
}
