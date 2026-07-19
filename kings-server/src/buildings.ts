// Building catalog for Kings, names/roles from the real client (design/DESIGN.md).
// Economic numbers are starter values (Travian-style), to be balanced later.
import type { BuildingDef } from "./model.js";

export const BUILDINGS: Record<string, BuildingDef> = {
  // --- core / infrastructure ---
  townhall:  { code: "townhall",  name: "Ратуша",         category: "infra",  maxLevel: 20, baseCost: { wood: 70, stone: 40, iron: 60, food: 20 } },
  warehouse: { code: "warehouse", name: "Склад",          category: "infra",  maxLevel: 20, baseCost: { wood: 60, stone: 50, iron: 30, food: 10 }, storage: true },
  market:    { code: "market",    name: "Рынок",          category: "infra",  maxLevel: 20, baseCost: { wood: 80, stone: 70, iron: 40, food: 20 } },
  embassy:   { code: "embassy",   name: "Посольство",     category: "infra",  maxLevel: 20, baseCost: { wood: 90, stone: 60, iron: 70, food: 30 } },

  // --- resource producers ---
  woodcutter: { code: "woodcutter", name: "Дровосек",   category: "resource", maxLevel: 20, baseCost: { wood: 20, stone: 30, iron: 10, food: 20 }, produces: { res: "wood",  basePerHour: 30 } },
  stonemason: { code: "stonemason", name: "Каменьщик",  category: "resource", maxLevel: 20, baseCost: { wood: 30, stone: 20, iron: 10, food: 20 }, produces: { res: "stone", basePerHour: 30 } },
  ironmine:   { code: "ironmine",   name: "Рудник",     category: "resource", maxLevel: 20, baseCost: { wood: 30, stone: 30, iron: 10, food: 20 }, produces: { res: "iron",  basePerHour: 30 } },
  garden:     { code: "garden",     name: "Огород",     category: "resource", maxLevel: 20, baseCost: { wood: 20, stone: 20, iron: 10, food: 10 }, produces: { res: "food",  basePerHour: 40 } },

  // --- housing (population cap) ---
  shack: { code: "shack", name: "Хибара", category: "infra", maxLevel: 20, baseCost: { wood: 30, stone: 20, iron: 20, food: 10 }, housing: 10 },

  // --- military ---
  barracks:    { code: "barracks",    name: "Казарма",         category: "military", maxLevel: 20, baseCost: { wood: 100, stone: 80,  iron: 90,  food: 40 } },
  stable:      { code: "stable",      name: "Конюшня",         category: "military", maxLevel: 20, baseCost: { wood: 120, stone: 90,  iron: 130, food: 60 } },
  military_hq: { code: "military_hq", name: "Военный штаб",     category: "military", maxLevel: 20, baseCost: { wood: 150, stone: 120, iron: 140, food: 50 } },
  mage_academy:{ code: "mage_academy",name: "Академия магов",   category: "military", maxLevel: 20, baseCost: { wood: 140, stone: 110, iron: 120, food: 60 } },
  workshop:    { code: "workshop",    name: "Мастерская",       category: "military", maxLevel: 20, baseCost: { wood: 160, stone: 140, iron: 180, food: 70 } },
  guard_tower: { code: "guard_tower", name: "Караульная башня", category: "military", maxLevel: 20, baseCost: { wood: 90,  stone: 130, iron: 70,  food: 20 } },
  fence:       { code: "fence",       name: "Забор",            category: "military", maxLevel: 20, baseCost: { wood: 80,  stone: 150, iron: 40,  food: 10 } },
  smithy:      { code: "smithy",      name: "Кузнец",           category: "military", maxLevel: 20, baseCost: { wood: 110, stone: 90,  iron: 160, food: 30 } },

  // --- science / special (roles per design doc; economy TBD) ---
  university:    { code: "university",    name: "Университет",         category: "science", maxLevel: 20, baseCost: { wood: 130, stone: 120, iron: 110, food: 50 } },
  sages_house:   { code: "sages_house",   name: "Дом мудрецов",        category: "science", maxLevel: 20, baseCost: { wood: 90,  stone: 80,  iron: 70,  food: 40 } },
  arch_camp:     { code: "arch_camp",     name: "Лагерь археологов",   category: "science", maxLevel: 20, baseCost: { wood: 100, stone: 90,  iron: 80,  food: 40 } },
  expedition:    { code: "expedition",    name: "Экспедиция",          category: "special", maxLevel: 20, baseCost: { wood: 120, stone: 100, iron: 90,  food: 50 } },
  artifact_tower:{ code: "artifact_tower",name: "Башня артефактов",    category: "special", maxLevel: 20, baseCost: { wood: 150, stone: 140, iron: 130, food: 60 } },
  commerce:      { code: "commerce",      name: "Торговая палата",     category: "infra",   maxLevel: 20, baseCost: { wood: 110, stone: 90,  iron: 80,  food: 40 } },
  traveler_house:{ code: "traveler_house",name: "Дом путешественника", category: "special", maxLevel: 20, baseCost: { wood: 200, stone: 180, iron: 170, food: 90 } },
  temple:        { code: "temple",        name: "Храм",                category: "special", maxLevel: 20, baseCost: { wood: 130, stone: 160, iron: 90,  food: 50 } },
  cache:         { code: "cache",         name: "Тайник",              category: "special", maxLevel: 20, baseCost: { wood: 70,  stone: 90,  iron: 60,  food: 20 } },
  spy_center:    { code: "spy_center",    name: "Центр шпионажа",      category: "special", maxLevel: 20, baseCost: { wood: 120, stone: 100, iron: 110, food: 40 } },
};

/** Starting layout of a fresh castle. */
export function startingLevels(): Record<string, number> {
  return {
    townhall: 1, warehouse: 1, shack: 1,
    woodcutter: 1, stonemason: 1, ironmine: 1, garden: 1,
  };
}
