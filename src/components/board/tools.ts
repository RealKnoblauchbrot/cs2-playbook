import type { BoardObject, MarkerIcon, UtilityKind } from "../../model/types";

export type Tool =
  | "select"
  | "player"
  | "enemy"
  | UtilityKind
  | "arrow"
  | "line"
  | "zone-rect"
  | "zone-circle"
  | "draw"
  | "text"
  | "icon"
  | "vision"
  | "eraser";

export const UTILITY_TOOLS: UtilityKind[] = ["smoke", "flash", "molotov", "he", "decoy"];

export const isUtilityTool = (t: Tool): t is UtilityKind => (UTILITY_TOOLS as string[]).includes(t);

export const TOOL_KEYS: Partial<Record<Tool, string>> = {
  select: "V",
  player: "P",
  enemy: "E",
  smoke: "S",
  flash: "F",
  molotov: "M",
  he: "H",
  decoy: "Y",
  arrow: "A",
  line: "L",
  "zone-rect": "R",
  "zone-circle": "C",
  draw: "D",
  text: "T",
  icon: "I",
  vision: "O",
  eraser: "X",
};

export const MARKER_ICONS: MarkerIcon[] = ["bomb", "defuse", "awp", "eye", "star", "warning", "x", "question", "timer"];

/** Objects that carry over when a new step is created from the current one. */
export const CARRY_OVER: BoardObject["kind"][] = ["player", "enemy", "utility", "zone", "icon", "text", "vision"];

export interface Pt {
  x: number;
  y: number;
}
