import { getMap, MAPS } from "../data/maps";
import type { Callout, MapData, Playbook, RoleAssignment, Side } from "./types";

export function builtinCallouts(mapId: string): Callout[] {
  return (getMap(mapId)?.callouts ?? []).map((c) => ({ id: c.key + ":" + c.level, name: c.name, x: c.x, y: c.y, level: c.level }));
}

export function getCallouts(pb: Playbook, mapId: string): Callout[] {
  return pb.maps.find((m) => m.id === mapId)?.callouts ?? builtinCallouts(mapId);
}

export function getMapData(pb: Playbook, mapId: string): MapData | undefined {
  return pb.maps.find((m) => m.id === mapId);
}

/** Built-in maps in the team's priority order; `onlyPool` hides maps not in pool. */
export function orderedMaps(pb: Playbook, onlyPool = false) {
  const data = new Map(pb.maps.map((m) => [m.id, m]));
  return MAPS.filter((m) => !onlyPool || data.get(m.id)?.inPool)
    .map((m) => ({ def: m, data: data.get(m.id)! }))
    .filter((m) => m.data)
    .sort((a, b) => a.data.priority - b.data.priority);
}

export function getRoleAssignment(pb: Playbook, mapId: string, side: Side): RoleAssignment | undefined {
  return (
    pb.roleAssignments.find((r) => r.mapId === mapId && r.side === side) ??
    pb.roleAssignments.find((r) => r.mapId === "default" && r.side === side)
  );
}

export function roleName(pb: Playbook, roleId: string | null): string {
  return (roleId && pb.roles.find((r) => r.id === roleId)?.name) || "";
}
