import { nanoid } from "nanoid";
import { MAPS } from "../data/maps";
import {
  SCHEMA_VERSION,
  type ID,
  type Lineup,
  type MapData,
  type Player,
  type Playbook,
  type RoleAssignment,
  type RoleDef,
  type RoundPlan,
  type Side,
  type Step,
  type Tactic,
  type TacticSlot,
  type VetoPlan,
} from "./types";

export const newId = (): ID => nanoid(12);
export const now = () => Date.now();

export const PLAYER_COLORS = ["#29b6f6", "#ffca28", "#ab47bc", "#66bb6a", "#ef5350", "#ff8a65", "#26c6da", "#d4e157"];

/** Pool shown by default (CS2 Active Duty + Cache as in the team's list). */
const DEFAULT_POOL = ["de_dust2", "de_mirage", "de_inferno", "de_nuke", "de_ancient", "de_anubis", "de_vertigo", "de_cache"];

export function defaultRoles(): RoleDef[] {
  const r = (name: string, side: RoleDef["side"], color: string, description = ""): RoleDef => ({
    id: newId(),
    name,
    side,
    color,
    description,
  });
  return [
    r("Entry", "T", "#ef5350", "First in, creates space."),
    r("2nd Entry", "T", "#ff8a65", "Trades the entry, follows up."),
    r("AWP", "both", "#66bb6a", "Primary AWPer."),
    r("Rifle", "both", "#81c784"),
    r("Support", "both", "#29b6f6", "Utility, flashes for teammates, trades."),
    r("IGL", "both", "#ffca28", "In-game leader, mid-round calls."),
    r("Lurker", "T", "#ab47bc", "Plays away from the team, catches rotations."),
    r("Anchor", "CT", "#26c6da", "Holds a site alone, waits for retake."),
    r("Rotator", "CT", "#90a4ae", "Plays between sites, rotates early."),
  ];
}

export function newPlayer(name: string, index: number): Player {
  const t = now();
  return {
    id: newId(),
    name,
    cutout: null,
    avatar: null,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    status: "main",
    notes: "",
    createdAt: t,
    updatedAt: t,
  };
}

export function newMapData(id: string, index: number): MapData {
  return {
    id,
    inPool: DEFAULT_POOL.includes(id),
    status: "neutral",
    comfort: 0,
    priority: index,
    poolNote: "",
    notes: "",
    callouts: null,
  };
}

export function newRoleAssignment(mapId: string, side: Side): RoleAssignment {
  return {
    mapId,
    side,
    slots: Array.from({ length: 5 }, () => ({ roleId: null, playerId: null })),
    notes: "",
  };
}

export function createPlaybook(teamName = "My Team", playerNames: string[] = []): Playbook {
  const t = now();
  const players = playerNames.filter((n) => n.trim()).map((n, i) => newPlayer(n.trim(), i));
  return {
    schema: SCHEMA_VERSION,
    id: newId(),
    createdAt: t,
    updatedAt: t,
    team: { name: teamName, tag: "", logo: null, accent: "#29b6f6" },
    players,
    roles: defaultRoles(),
    roleAssignments: [newRoleAssignment("default", "T"), newRoleAssignment("default", "CT")],
    maps: MAPS.map((m, i) => newMapData(m.id, i)),
    tactics: [],
    lineups: [],
    vetos: [],
    rounds: [],
  };
}

export function newStep(name: string): Step {
  return { id: newId(), name, notes: "", objects: [] };
}

export function newSlots(players: Player[]): TacticSlot[] {
  const mains = players.filter((p) => p.status === "main");
  return Array.from({ length: 5 }, (_, i) => ({
    id: newId(),
    playerId: mains[i]?.id ?? null,
    role: "",
    notes: "",
  }));
}

export function newTactic(mapId: string, side: Side, players: Player[], name: string): Tactic {
  const t = now();
  return {
    id: newId(),
    mapId,
    side,
    name,
    type: side === "T" ? "execute" : "setup",
    buy: "full",
    tags: [],
    description: "",
    favorite: false,
    slots: newSlots(players),
    steps: [newStep("Setup")],
    createdAt: t,
    updatedAt: t,
  };
}

export function newLineup(mapId: string): Lineup {
  const t = now();
  return {
    id: newId(),
    mapId,
    name: "",
    util: "smoke",
    side: "T",
    throwPos: { x: 0.45, y: 0.55 },
    landPos: { x: 0.55, y: 0.45 },
    level: "default",
    technique: "jump",
    description: "",
    setpos: "",
    media: [],
    tags: [],
    createdAt: t,
    updatedAt: t,
  };
}

export function newVeto(): VetoPlan {
  const t = now();
  return {
    id: newId(),
    name: "",
    opponent: "",
    format: "bo3",
    weStart: true,
    steps: [],
    notes: "",
    createdAt: t,
    updatedAt: t,
  };
}

export function newRoundPlan(): RoundPlan {
  const t = now();
  return {
    id: newId(),
    name: "",
    category: "pistol",
    side: "T",
    mapId: null,
    description: "",
    minTeamMoney: null,
    buys: Array.from({ length: 5 }, (_, i) => ({ slot: i, playerId: null, items: [], note: "" })),
    tacticIds: [],
    createdAt: t,
    updatedAt: t,
  };
}

/** Deep clone a tactic with fresh ids (slots remapped inside steps). */
export function cloneTactic(src: Tactic, name: string): Tactic {
  const t = now();
  const slotMap = new Map<ID, ID>();
  const slots = src.slots.map((s) => {
    const id = newId();
    slotMap.set(s.id, id);
    return { ...s, id };
  });
  const remap = (id: ID | null) => (id ? slotMap.get(id) ?? id : null);
  const steps = src.steps.map((st) => ({
    ...st,
    id: newId(),
    objects: st.objects.map((o) => {
      const c = structuredClone(o);
      c.id = newId();
      if ("slotId" in c) (c as { slotId: ID | null }).slotId = remap(c.slotId);
      return c;
    }),
  }));
  return { ...structuredClone(src), id: newId(), name, slots, steps, createdAt: t, updatedAt: t };
}
