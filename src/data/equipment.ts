import type { Side, UtilityKind } from "../model/types";

export type EquipCategory = "pistol" | "smg" | "heavy" | "rifle" | "sniper" | "gear" | "grenade";

export interface Equipment {
  id: string;
  name: string;
  price: number;
  side: Side | "both";
  category: EquipCategory;
}

/** CS2 buy menu. Prices can change with game updates – adjust here. Icons: public/assets/equipment/<id>.svg */
export const EQUIPMENT: Equipment[] = [
  { id: "glock", name: "Glock-18", price: 200, side: "T", category: "pistol" },
  { id: "usp_silencer", name: "USP-S", price: 200, side: "CT", category: "pistol" },
  { id: "hkp2000", name: "P2000", price: 200, side: "CT", category: "pistol" },
  { id: "elite", name: "Dual Berettas", price: 300, side: "both", category: "pistol" },
  { id: "p250", name: "P250", price: 300, side: "both", category: "pistol" },
  { id: "tec9", name: "Tec-9", price: 500, side: "T", category: "pistol" },
  { id: "fiveseven", name: "Five-SeveN", price: 500, side: "CT", category: "pistol" },
  { id: "cz75a", name: "CZ75-Auto", price: 500, side: "both", category: "pistol" },
  { id: "deagle", name: "Desert Eagle", price: 700, side: "both", category: "pistol" },
  { id: "revolver", name: "R8 Revolver", price: 600, side: "both", category: "pistol" },

  { id: "mac10", name: "MAC-10", price: 1050, side: "T", category: "smg" },
  { id: "mp9", name: "MP9", price: 1250, side: "CT", category: "smg" },
  { id: "mp7", name: "MP7", price: 1500, side: "both", category: "smg" },
  { id: "mp5sd", name: "MP5-SD", price: 1500, side: "both", category: "smg" },
  { id: "ump45", name: "UMP-45", price: 1200, side: "both", category: "smg" },
  { id: "p90", name: "P90", price: 2350, side: "both", category: "smg" },
  { id: "bizon", name: "PP-Bizon", price: 1400, side: "both", category: "smg" },

  { id: "nova", name: "Nova", price: 1050, side: "both", category: "heavy" },
  { id: "xm1014", name: "XM1014", price: 2000, side: "both", category: "heavy" },
  { id: "mag7", name: "MAG-7", price: 1300, side: "CT", category: "heavy" },
  { id: "sawedoff", name: "Sawed-Off", price: 1100, side: "T", category: "heavy" },
  { id: "negev", name: "Negev", price: 1700, side: "both", category: "heavy" },
  { id: "m249", name: "M249", price: 5200, side: "both", category: "heavy" },

  { id: "galilar", name: "Galil AR", price: 1800, side: "T", category: "rifle" },
  { id: "famas", name: "FAMAS", price: 2050, side: "CT", category: "rifle" },
  { id: "ak47", name: "AK-47", price: 2700, side: "T", category: "rifle" },
  { id: "m4a1", name: "M4A4", price: 3100, side: "CT", category: "rifle" },
  { id: "m4a1_silencer", name: "M4A1-S", price: 2900, side: "CT", category: "rifle" },
  { id: "sg556", name: "SG 553", price: 3000, side: "T", category: "rifle" },
  { id: "aug", name: "AUG", price: 3300, side: "CT", category: "rifle" },

  { id: "ssg08", name: "SSG 08", price: 1700, side: "both", category: "sniper" },
  { id: "awp", name: "AWP", price: 4750, side: "both", category: "sniper" },
  { id: "g3sg1", name: "G3SG1", price: 5000, side: "T", category: "sniper" },
  { id: "scar20", name: "SCAR-20", price: 5000, side: "CT", category: "sniper" },

  { id: "kevlar", name: "Kevlar", price: 650, side: "both", category: "gear" },
  { id: "assaultsuit", name: "Kevlar + Helmet", price: 1000, side: "both", category: "gear" },
  { id: "defuser", name: "Defuse Kit", price: 400, side: "CT", category: "gear" },
  { id: "taser", name: "Zeus x27", price: 200, side: "both", category: "gear" },

  { id: "smokegrenade", name: "Smoke", price: 300, side: "both", category: "grenade" },
  { id: "flashbang", name: "Flash", price: 200, side: "both", category: "grenade" },
  { id: "hegrenade", name: "HE", price: 300, side: "both", category: "grenade" },
  { id: "molotov", name: "Molotov", price: 400, side: "T", category: "grenade" },
  { id: "incgrenade", name: "Incendiary", price: 500, side: "CT", category: "grenade" },
  { id: "decoy", name: "Decoy", price: 50, side: "both", category: "grenade" },
];

const byId = new Map(EQUIPMENT.map((e) => [e.id, e]));
export const getEquipment = (id: string) => byId.get(id);

export function equipmentIconUrl(id: string): string {
  return `${import.meta.env.BASE_URL}assets/equipment/${id}.svg`;
}

export interface UtilityDef {
  kind: UtilityKind;
  icon: string; // equipment id
  color: string;
  /** Effect radius in board units (1024 = radar size), rough visual guide. */
  radius: number;
}

export const UTILITY: Record<UtilityKind, UtilityDef> = {
  smoke: { kind: "smoke", icon: "smokegrenade", color: "#cfd8dc", radius: 36 },
  flash: { kind: "flash", icon: "flashbang", color: "#fff176", radius: 18 },
  molotov: { kind: "molotov", icon: "molotov", color: "#ff7043", radius: 26 },
  he: { kind: "he", icon: "hegrenade", color: "#81c784", radius: 22 },
  decoy: { kind: "decoy", icon: "decoy", color: "#b0bec5", radius: 14 },
};

export const UTILITY_KINDS: UtilityKind[] = ["smoke", "flash", "molotov", "he", "decoy"];

/** Loss bonus ladder in CS2 MR12. */
export const LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
export const START_MONEY = 800;
export const MAX_MONEY = 16000;
