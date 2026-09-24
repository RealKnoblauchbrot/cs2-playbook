/**
 * Playbook data model. Everything a team shares lives in one Playbook.
 * Board coordinates are normalized (0..1) relative to the 1024x1024 radar image.
 */

export type ID = string;
export type MediaID = string;
export type Side = "T" | "CT";
export type LevelId = "default" | "lower";

export const SCHEMA_VERSION = 1;

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export interface Team {
  name: string;
  tag: string;
  logo: MediaID | null;
  accent: string;
}

export type PlayerStatus = "main" | "sub" | "coach";

export interface Player extends Timestamps {
  id: ID;
  name: string;
  /** Full-body jersey cutout (transparent PNG preferred). */
  cutout: MediaID | null;
  /** Portrait / face picture used for round avatars. Falls back to cutout. */
  avatar: MediaID | null;
  color: string;
  status: PlayerStatus;
  notes: string;
}

export interface RoleDef {
  id: ID;
  name: string;
  side: Side | "both";
  color: string;
  description: string;
}

/** Default role lineup, either global ("default") or per map override. */
export interface RoleAssignment {
  mapId: string; // "default" or map id
  side: Side;
  slots: { roleId: ID | null; playerId: ID | null }[];
  notes: string;
}

export interface Callout {
  id: ID;
  name: string;
  x: number;
  y: number;
  level: LevelId;
}

export type PoolStatus = "pick" | "neutral" | "ban" | "permaban";

/** Per-map team data (callouts are a full editable copy of the built-in list). */
export interface MapData {
  id: string;
  inPool: boolean;
  status: PoolStatus;
  comfort: number; // 0..5
  priority: number; // lower = earlier in lists
  /** Short one-liner shown in the map pool list. */
  poolNote: string;
  notes: string;
  callouts: Callout[] | null; // null = use built-in callouts
}

// ---------------------------------------------------------------- Board objects

export type UtilityKind = "smoke" | "flash" | "molotov" | "he" | "decoy";

export interface Pt {
  x: number;
  y: number;
}

interface BaseObj {
  id: ID;
  level: LevelId;
}

export interface PlayerObj extends BaseObj {
  kind: "player";
  slotId: ID;
  x: number;
  y: number;
  /** Optional look direction in degrees (0 = right, 90 = down). */
  facing: number | null;
}

export interface EnemyObj extends BaseObj {
  kind: "enemy";
  x: number;
  y: number;
  label: string;
}

export interface UtilityObj extends BaseObj {
  kind: "utility";
  util: UtilityKind;
  x: number;
  y: number;
  /** Throw position; draws a trajectory line when set. */
  from: Pt | null;
  slotId: ID | null;
  lineupId: ID | null;
  note: string;
}

export interface ArrowObj extends BaseObj {
  kind: "arrow";
  points: number[]; // flat [x0,y0,x1,y1,...]
  color: string;
  width: number;
  dashed: boolean;
  head: boolean;
  curved: boolean;
  slotId: ID | null;
}

export interface ZoneObj extends BaseObj {
  kind: "zone";
  shape: "rect" | "circle";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  label: string;
}

export interface DrawObj extends BaseObj {
  kind: "draw";
  points: number[];
  color: string;
  width: number;
}

export interface TextObj extends BaseObj {
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export type MarkerIcon = "bomb" | "defuse" | "awp" | "eye" | "star" | "warning" | "x" | "question" | "timer";

export interface IconObj extends BaseObj {
  kind: "icon";
  icon: MarkerIcon;
  x: number;
  y: number;
  color: string;
}

export interface VisionObj extends BaseObj {
  kind: "vision";
  x: number;
  y: number;
  angle: number; // degrees
  spread: number; // degrees
  length: number; // normalized
  color: string;
  slotId: ID | null;
}

export type BoardObject =
  | PlayerObj
  | EnemyObj
  | UtilityObj
  | ArrowObj
  | ZoneObj
  | DrawObj
  | TextObj
  | IconObj
  | VisionObj;

export type BoardObjectKind = BoardObject["kind"];

// ---------------------------------------------------------------- Tactics

export type TacticType =
  | "default"
  | "execute"
  | "rush"
  | "split"
  | "fake"
  | "contact"
  | "pistol"
  | "anti-eco"
  | "force"
  | "setup"
  | "stack"
  | "aggression"
  | "retake"
  | "other";

export type BuyType = "any" | "pistol" | "eco" | "force" | "full";

export interface TacticSlot {
  id: ID;
  playerId: ID | null;
  role: string;
  notes: string;
}

export interface Step {
  id: ID;
  name: string;
  notes: string;
  objects: BoardObject[];
}

export interface Tactic extends Timestamps {
  id: ID;
  mapId: string;
  side: Side;
  name: string;
  type: TacticType;
  buy: BuyType;
  tags: string[];
  description: string;
  favorite: boolean;
  slots: TacticSlot[];
  steps: Step[];
}

// ---------------------------------------------------------------- Lineups

export type ThrowTechnique =
  | "left"
  | "right"
  | "left-right"
  | "jump"
  | "run-jump"
  | "walk-jump"
  | "crouch"
  | "run"
  | "walk";

export interface Lineup extends Timestamps {
  id: ID;
  mapId: string;
  name: string;
  util: UtilityKind;
  side: Side | "both";
  throwPos: Pt;
  landPos: Pt;
  level: LevelId;
  technique: ThrowTechnique;
  description: string;
  setpos: string;
  media: MediaID[];
  tags: string[];
}

// ---------------------------------------------------------------- Veto

export type VetoFormat = "bo1" | "bo3" | "bo5";
export type VetoTeam = "us" | "them";
export type VetoAction = "ban" | "pick" | "decider";

export interface VetoStep {
  action: VetoAction;
  team: VetoTeam | null;
  mapId: string | null;
  sideChoice: Side | null; // side we start on for picked/decider maps
}

export interface VetoPlan extends Timestamps {
  id: ID;
  name: string;
  opponent: string;
  format: VetoFormat;
  weStart: boolean;
  steps: VetoStep[];
  notes: string;
}

// ---------------------------------------------------------------- Round plans

export type RoundCategory =
  | "pistol"
  | "anti-eco"
  | "eco"
  | "force"
  | "bonus"
  | "full"
  | "save"
  | "rules";

export interface BuyEntry {
  slot: number; // 0..4 index into default lineup
  playerId: ID | null;
  items: string[]; // equipment ids
  note: string;
}

export interface RoundPlan extends Timestamps {
  id: ID;
  name: string;
  category: RoundCategory;
  side: Side | "both";
  mapId: string | null; // null = all maps
  description: string;
  minTeamMoney: number | null;
  buys: BuyEntry[];
  tacticIds: ID[];
}

// ---------------------------------------------------------------- Playbook root

export interface Playbook {
  schema: number;
  id: ID;
  createdAt: number;
  updatedAt: number;
  team: Team;
  players: Player[];
  roles: RoleDef[];
  roleAssignments: RoleAssignment[];
  maps: MapData[];
  tactics: Tactic[];
  lineups: Lineup[];
  vetos: VetoPlan[];
  rounds: RoundPlan[];
}

export interface MediaInfo {
  id: MediaID;
  mime: string;
  ext: string;
}
