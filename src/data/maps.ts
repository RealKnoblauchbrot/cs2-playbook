import generated from "./maps.generated.json";
import type { LevelId } from "../model/types";

export interface BuiltinCallout {
  key: string;
  name: string;
  x: number;
  y: number;
  level: LevelId;
}

export interface MapDef {
  id: string;
  name: string;
  levels: { id: LevelId; name: string }[];
  posX: number;
  posY: number;
  scale: number;
  lowerAltitudeMax: number | null;
  tSpawn: [number, number];
  ctSpawn: [number, number];
  bombA: [number, number];
  bombB: [number, number];
  callouts: BuiltinCallout[];
}

export const MAPS: MapDef[] = generated as MapDef[];

const byId = new Map(MAPS.map((m) => [m.id, m]));

export function getMap(id: string): MapDef | undefined {
  return byId.get(id);
}

export function mapName(id: string): string {
  return byId.get(id)?.name ?? id;
}

const base = import.meta.env.BASE_URL;

export function radarUrl(mapId: string, level: LevelId = "default"): string {
  return `${base}assets/maps/${mapId}/${level === "lower" ? "radar_lower" : "radar"}.webp`;
}

export function mapCoverUrl(mapId: string): string {
  return `${base}assets/maps/${mapId}/cover.webp`;
}

export function mapIconUrl(mapId: string): string {
  return `${base}assets/maps/${mapId}/icon.svg`;
}

/** Size of the radar image in board units. All normalized coords multiply by this. */
export const BOARD_SIZE = 1024;

/** Convert CS2 world coordinates (e.g. from `getpos`) to normalized radar coords. */
export function worldToRadar(map: MapDef, x: number, y: number): { x: number; y: number } {
  return {
    x: (x - map.posX) / map.scale / BOARD_SIZE,
    y: (map.posY - y) / map.scale / BOARD_SIZE,
  };
}

/** Parse "setpos 123 456 78;setang ..." or "getpos" output into world coords. */
export function parseSetpos(input: string): { x: number; y: number; z: number } | null {
  const m = input.match(/setpos(?:_exact)?\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
}

export function levelForZ(map: MapDef, z: number): LevelId {
  return map.lowerAltitudeMax != null && z < map.lowerAltitudeMax ? "lower" : "default";
}
