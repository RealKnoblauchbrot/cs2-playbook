import { MAPS } from "../data/maps";
import { createPlaybook, newMapData, newRoleAssignment } from "./factory";
import { SCHEMA_VERSION, type Playbook } from "./types";

/**
 * Bring any stored/imported playbook up to the current schema and fill in
 * missing fields, so older files and newer app versions stay compatible.
 */
export function migratePlaybook(raw: unknown): Playbook {
  const input = (raw ?? {}) as Partial<Playbook>;
  const schema = typeof input.schema === "number" ? input.schema : 0;
  if (schema > SCHEMA_VERSION) {
    throw new Error(`This playbook was created by a newer app version (schema ${schema}). Please update the app.`);
  }

  const base = createPlaybook();
  const pb: Playbook = {
    ...base,
    ...input,
    schema: SCHEMA_VERSION,
    team: { ...base.team, ...(input.team ?? {}) },
    players: input.players ?? [],
    roles: input.roles ?? base.roles,
    roleAssignments: input.roleAssignments ?? base.roleAssignments,
    maps: input.maps ?? [],
    tactics: input.tactics ?? [],
    lineups: input.lineups ?? [],
    vetos: input.vetos ?? [],
    rounds: input.rounds ?? [],
  };

  // Future: if (schema < 2) { ...transform... }

  // Every built-in map gets a MapData entry (new maps added by app updates).
  const have = new Set(pb.maps.map((m) => m.id));
  MAPS.forEach((m, i) => {
    if (!have.has(m.id)) pb.maps.push({ ...newMapData(m.id, pb.maps.length + i), inPool: false });
  });

  for (const side of ["T", "CT"] as const) {
    if (!pb.roleAssignments.some((r) => r.mapId === "default" && r.side === side)) {
      pb.roleAssignments.push(newRoleAssignment("default", side));
    }
  }

  for (const m of pb.maps) m.poolNote ??= "";
  for (const t of pb.tactics) {
    t.tags ??= [];
    t.steps ??= [];
    t.slots ??= [];
    t.favorite ??= false;
    t.buy ??= "any";
  }
  for (const l of pb.lineups) {
    l.media ??= [];
    l.tags ??= [];
  }
  return pb;
}
