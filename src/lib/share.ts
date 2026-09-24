import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { cloneTactic, newId } from "../model/factory";
import { migratePlaybook } from "../model/migrate";
import type {
  ID,
  Lineup,
  MapData,
  MediaID,
  Player,
  Playbook,
  RoleAssignment,
  RoleDef,
  RoundPlan,
  Tactic,
  Team,
  VetoPlan,
} from "../model/types";
import { SCHEMA_VERSION } from "../model/types";
import { platform } from "./platform";

export const SHARE_EXT = "cs2pb";
export const SHARE_FILTER = [{ name: "CS2 Playbook", extensions: [SHARE_EXT] }];

export interface ShareManifest {
  format: "cs2pb";
  version: number;
  schema: number;
  appVersion: string;
  exportedAt: number;
  exportedBy: string;
  teamName: string;
  playbookId: string;
  full: boolean;
}

export interface ShareData {
  team?: Team;
  players: Player[];
  roles: RoleDef[];
  roleAssignments: RoleAssignment[];
  maps: MapData[];
  tactics: Tactic[];
  lineups: Lineup[];
  vetos: VetoPlan[];
  rounds: RoundPlan[];
}

export interface ShareContents {
  manifest: ShareManifest;
  data: ShareData;
  media: Map<MediaID, Uint8Array>;
}

export interface ExportSelection {
  tacticIds: ID[];
  lineupIds: ID[];
  vetoIds: ID[];
  roundIds: ID[];
  roster: boolean; // team info, players, roles, default roles
  maps: boolean; // map pool, comfort, notes, callouts
}

export function fullSelection(pb: Playbook): ExportSelection {
  return {
    tacticIds: pb.tactics.map((t) => t.id),
    lineupIds: pb.lineups.map((l) => l.id),
    vetoIds: pb.vetos.map((v) => v.id),
    roundIds: pb.rounds.map((r) => r.id),
    roster: true,
    maps: true,
  };
}

// ------------------------------------------------------------------ Export

export async function buildShareFile(pb: Playbook, sel: ExportSelection, exportedBy: string): Promise<Uint8Array> {
  const pick = <T extends { id: ID }>(list: T[], ids: ID[]) => {
    const set = new Set(ids);
    return list.filter((x) => set.has(x.id));
  };
  const tactics = pick(pb.tactics, sel.tacticIds);
  const rounds = pick(pb.rounds, sel.roundIds);

  // Lineups referenced by utility in exported tactics come along automatically.
  const lineupIds = new Set(sel.lineupIds);
  for (const t of tactics) for (const s of t.steps) for (const o of s.objects) if (o.kind === "utility" && o.lineupId) lineupIds.add(o.lineupId);
  const lineups = pick(pb.lineups, [...lineupIds]);

  // Players referenced anywhere come along so tokens keep their names/photos.
  const playerIds = new Set<ID>();
  if (sel.roster) pb.players.forEach((p) => playerIds.add(p.id));
  tactics.forEach((t) => t.slots.forEach((s) => s.playerId && playerIds.add(s.playerId)));
  rounds.forEach((r) => r.buys.forEach((b) => b.playerId && playerIds.add(b.playerId)));
  const players = pb.players.filter((p) => playerIds.has(p.id));

  const data: ShareData = {
    team: sel.roster ? pb.team : undefined,
    players,
    roles: sel.roster ? pb.roles : [],
    roleAssignments: sel.roster ? pb.roleAssignments : [],
    maps: sel.maps ? pb.maps : [],
    tactics,
    lineups,
    vetos: pick(pb.vetos, sel.vetoIds),
    rounds,
  };

  const mediaIds = new Set<MediaID>();
  players.forEach((p) => [p.cutout, p.avatar].forEach((m) => m && mediaIds.add(m)));
  lineups.forEach((l) => l.media.forEach((m) => mediaIds.add(m)));
  if (data.team?.logo) mediaIds.add(data.team.logo);

  const isFull =
    sel.roster &&
    sel.maps &&
    tactics.length === pb.tactics.length &&
    lineups.length === pb.lineups.length &&
    data.vetos.length === pb.vetos.length &&
    rounds.length === pb.rounds.length;

  const manifest: ShareManifest = {
    format: "cs2pb",
    version: 1,
    schema: SCHEMA_VERSION,
    appVersion: __APP_VERSION__,
    exportedAt: Date.now(),
    exportedBy,
    teamName: pb.team.name,
    playbookId: pb.id,
    full: isFull,
  };

  const files: Zippable = {
    "manifest.json": [strToU8(JSON.stringify(manifest, null, 1)), { level: 6 }],
    "data.json": [strToU8(JSON.stringify(data)), { level: 6 }],
  };
  for (const id of mediaIds) {
    const bytes = await platform.readMedia(id);
    if (bytes) files[`media/${id}`] = [bytes, { level: 0 }];
  }
  return zipSync(files);
}

// ------------------------------------------------------------------ Read

export function readShareFile(bytes: Uint8Array): ShareContents {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Not a valid CS2 Playbook file.");
  }
  if (!files["manifest.json"] || !files["data.json"]) throw new Error("Not a valid CS2 Playbook file.");
  const manifest = JSON.parse(strFromU8(files["manifest.json"])) as ShareManifest;
  if (manifest.format !== "cs2pb") throw new Error("Not a valid CS2 Playbook file.");
  if (manifest.schema > SCHEMA_VERSION) throw new Error("This file was made with a newer version of CS2 Playbook. Please update the app first.");
  const raw = JSON.parse(strFromU8(files["data.json"])) as Partial<ShareData>;

  // Run the same migration as for full playbooks to normalize old files.
  const norm = migratePlaybook({ ...raw, schema: manifest.schema, maps: raw.maps ?? [] });
  const data: ShareData = {
    team: raw.team ? norm.team : undefined,
    players: norm.players,
    roles: raw.roles ?? [],
    roleAssignments: raw.roleAssignments ?? [],
    maps: raw.maps ?? [],
    tactics: norm.tactics,
    lineups: norm.lineups,
    vetos: norm.vetos,
    rounds: norm.rounds,
  };

  const media = new Map<MediaID, Uint8Array>();
  for (const [name, content] of Object.entries(files)) {
    const m = name.match(/^media\/([a-zA-Z0-9_-]+\.[a-z0-9]+)$/);
    if (m) media.set(m[1], content);
  }
  return { manifest, data, media };
}

// ------------------------------------------------------------------ Analyze

export type ImportGroup = "team" | "players" | "roles" | "roleAssignments" | "maps" | "tactics" | "lineups" | "vetos" | "rounds";
export type ImportStatus = "new" | "newer" | "older" | "same" | "changed";
export type ImportAction = "add" | "replace" | "skip" | "copy";

export interface ImportItem {
  key: string;
  group: ImportGroup;
  id: ID;
  name: string;
  status: ImportStatus;
  action: ImportAction;
  actions: ImportAction[];
}

const stable = (v: unknown) => JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort()) : val));

/** Incoming player id -> existing player id, matched by id or (case-insensitive) name. */
export function matchPlayers(pb: Playbook, incoming: Player[]): Map<ID, ID> {
  const out = new Map<ID, ID>();
  for (const p of incoming) {
    if (pb.players.some((x) => x.id === p.id)) out.set(p.id, p.id);
    else {
      const byName = pb.players.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (byName) out.set(p.id, byName.id);
    }
  }
  return out;
}

function matchRoles(pb: Playbook, incoming: RoleDef[]): Map<ID, ID> {
  const out = new Map<ID, ID>();
  for (const r of incoming) {
    const hit = pb.roles.find((x) => x.id === r.id) ?? pb.roles.find((x) => x.name.toLowerCase() === r.name.toLowerCase());
    if (hit) out.set(r.id, hit.id);
  }
  return out;
}

export function analyzeImport(pb: Playbook, c: ShareContents): ImportItem[] {
  const items: ImportItem[] = [];
  const playerMatch = matchPlayers(pb, c.data.players);

  const timed = <T extends { id: ID; updatedAt: number }>(group: ImportGroup, list: T[], existingList: T[], name: (x: T) => string, idMap?: Map<ID, ID>) => {
    for (const inc of list) {
      const exId = idMap?.get(inc.id) ?? inc.id;
      const ex = existingList.find((x) => x.id === exId);
      let status: ImportStatus;
      if (!ex) status = "new";
      else if (stable({ ...inc, id: exId, updatedAt: 0, createdAt: 0 }) === stable({ ...ex, updatedAt: 0, createdAt: 0 })) status = "same";
      else status = inc.updatedAt > ex.updatedAt ? "newer" : "older";
      const action: ImportAction = status === "new" ? "add" : status === "newer" ? "replace" : "skip";
      const actions: ImportAction[] = status === "new" ? ["add", "skip"] : status === "same" ? ["skip"] : ["replace", "copy", "skip"];
      items.push({ key: `${group}:${inc.id}`, group, id: inc.id, name: name(inc), status, action, actions: group === "players" ? actions.filter((a) => a !== "copy") : actions });
    }
  };

  const untimed = <T,>(group: ImportGroup, id: string, name: string, inc: T, ex: T | undefined) => {
    const status: ImportStatus = ex === undefined ? "new" : stable(inc) === stable(ex) ? "same" : "changed";
    items.push({
      key: `${group}:${id}`,
      group,
      id,
      name,
      status,
      action: status === "new" ? "add" : status === "changed" ? "replace" : "skip",
      actions: status === "new" ? ["add", "skip"] : status === "same" ? ["skip"] : ["replace", "skip"],
    });
  };

  if (c.data.team) untimed("team", "team", c.data.team.name, c.data.team, pb.team);
  timed("players", c.data.players, pb.players, (p) => p.name, playerMatch);
  const roleMatch = matchRoles(pb, c.data.roles);
  for (const r of c.data.roles) {
    const ex = pb.roles.find((x) => x.id === roleMatch.get(r.id));
    untimed("roles", r.id, r.name, { ...r, id: ex?.id ?? r.id }, ex);
  }
  for (const ra of c.data.roleAssignments) {
    const ex = pb.roleAssignments.find((x) => x.mapId === ra.mapId && x.side === ra.side);
    untimed("roleAssignments", `${ra.mapId}:${ra.side}`, `${ra.mapId === "default" ? "Default" : ra.mapId} ${ra.side}`, ra, ex);
  }
  for (const m of c.data.maps) untimed("maps", m.id, m.id, m, pb.maps.find((x) => x.id === m.id));
  timed("tactics", c.data.tactics, pb.tactics, (t) => t.name);
  timed("lineups", c.data.lineups, pb.lineups, (l) => l.name);
  timed("vetos", c.data.vetos, pb.vetos, (v) => v.name || v.opponent);
  timed("rounds", c.data.rounds, pb.rounds, (r) => r.name);
  return items;
}

// ------------------------------------------------------------------ Apply

/**
 * Merge selected items into a draft playbook. Player/role references in
 * incoming data are remapped onto matching existing entries.
 */
export function applyImport(d: Playbook, c: ShareContents, items: ImportItem[]) {
  const act = new Map(items.map((i) => [i.key, i.action]));
  const playerMatch = matchPlayers(d, c.data.players);
  const roleMatch = matchRoles(d, c.data.roles);
  const pid = (id: ID | null) => (id ? playerMatch.get(id) ?? id : null);
  const rid = (id: ID | null) => (id ? roleMatch.get(id) ?? id : null);

  const upsert = <T extends { id: ID }>(list: T[], inc: T, action: ImportAction | undefined, exId: ID = inc.id) => {
    const idx = list.findIndex((x) => x.id === exId);
    if (action === "add" && idx < 0) list.push(inc);
    else if (action === "replace") {
      if (idx >= 0) list[idx] = { ...inc, id: exId };
      else list.push(inc);
    }
  };

  if (c.data.team && act.get("team:team") !== "skip" && act.has("team:team")) d.team = { ...c.data.team };

  for (const p of c.data.players) upsert(d.players, p, act.get(`players:${p.id}`), playerMatch.get(p.id) ?? p.id);

  for (const r of c.data.roles) upsert(d.roles, r, act.get(`roles:${r.id}`), roleMatch.get(r.id) ?? r.id);

  for (const ra of c.data.roleAssignments) {
    const a = act.get(`roleAssignments:${ra.mapId}:${ra.side}`);
    if (a !== "add" && a !== "replace") continue;
    const next = { ...ra, slots: ra.slots.map((s) => ({ roleId: rid(s.roleId), playerId: pid(s.playerId) })) };
    const idx = d.roleAssignments.findIndex((x) => x.mapId === ra.mapId && x.side === ra.side);
    if (idx >= 0) d.roleAssignments[idx] = next;
    else d.roleAssignments.push(next);
  }

  for (const m of c.data.maps) {
    const a = act.get(`maps:${m.id}`);
    if (a !== "add" && a !== "replace") continue;
    const idx = d.maps.findIndex((x) => x.id === m.id);
    if (idx >= 0) d.maps[idx] = m;
    else d.maps.push(m);
  }

  for (const t of c.data.tactics) {
    const a = act.get(`tactics:${t.id}`);
    const remapped: Tactic = { ...t, slots: t.slots.map((s) => ({ ...s, playerId: pid(s.playerId) })) };
    if (a === "copy") d.tactics.push(cloneTactic(remapped, `${t.name} (imported)`));
    else upsert(d.tactics, remapped, a);
  }

  for (const l of c.data.lineups) {
    const a = act.get(`lineups:${l.id}`);
    if (a === "copy") d.lineups.push({ ...l, id: newId(), name: `${l.name} (imported)` });
    else upsert(d.lineups, l, a);
  }
  for (const v of c.data.vetos) {
    const a = act.get(`vetos:${v.id}`);
    if (a === "copy") d.vetos.push({ ...v, id: newId() });
    else upsert(d.vetos, v, a);
  }
  for (const r of c.data.rounds) {
    const a = act.get(`rounds:${r.id}`);
    const remapped = { ...r, buys: r.buys.map((b) => ({ ...b, playerId: pid(b.playerId) })) };
    if (a === "copy") d.rounds.push({ ...remapped, id: newId() });
    else upsert(d.rounds, remapped, a);
  }
}

export async function writeImportedMedia(c: ShareContents) {
  for (const [id, bytes] of c.media) {
    if (!(await platform.hasMedia(id))) await platform.writeMedia(id, bytes);
  }
}
