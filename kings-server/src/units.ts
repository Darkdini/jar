// Unit catalog for Kings — names from the client, stats Travian-style starters.
// (design/DESIGN.md §4). To be balanced later.
import type { ResourceKey } from "./model.js";

export type Race = "human" | "elf" | "dwarf" | "unique";

export interface UnitDef {
  code: string;
  name: string;        // Russian in-game name
  race: Race;
  building: string;    // where it is trained
  buildingMin: number; // min level of that building
  cost: Partial<Record<ResourceKey, number>>;
  upkeep: number;      // food per hour
  pop: number;         // population slots consumed
  atk: number;
  defInf: number;      // defence vs infantry
  defCav: number;      // defence vs cavalry
  speed: number;       // map cells per hour
  carry: number;       // loot capacity
  trainSeconds: number;
}

// Humans — full starter set (7 units from strings.txt).
export const UNITS: Record<string, UnitDef> = {
  swordman:  { code: "swordman",  name: "Мечник",    race: "human", building: "barracks",     buildingMin: 1, cost: { wood: 95,  stone: 75,  iron: 40,  food: 40 },  upkeep: 1, pop: 1, atk: 40,  defInf: 35, defCav: 60, speed: 6,  carry: 60,  trainSeconds: 60 },
  spearman:  { code: "spearman",  name: "Копейщик",  race: "human", building: "barracks",     buildingMin: 1, cost: { wood: 65,  stone: 30,  iron: 60,  food: 40 },  upkeep: 1, pop: 1, atk: 10,  defInf: 25, defCav: 40, speed: 7,  carry: 40,  trainSeconds: 55 },
  scout:     { code: "scout",     name: "Разведчик", race: "human", building: "barracks",     buildingMin: 3, cost: { wood: 140, stone: 30,  iron: 20,  food: 40 },  upkeep: 1, pop: 1, atk: 0,   defInf: 20, defCav: 10, speed: 16, carry: 0,   trainSeconds: 90 },
  mage:      { code: "mage",      name: "Чародей",   race: "human", building: "mage_academy", buildingMin: 1, cost: { wood: 130, stone: 200, iron: 160, food: 70 },  upkeep: 3, pop: 1, atk: 90,  defInf: 30, defCav: 30, speed: 7,  carry: 50,  trainSeconds: 200 },
  knight:    { code: "knight",    name: "Рыцарь",    race: "human", building: "stable",       buildingMin: 1, cost: { wood: 260, stone: 140, iron: 220, food: 100 }, upkeep: 3, pop: 2, atk: 120, defInf: 65, defCav: 50, speed: 10, carry: 100, trainSeconds: 300 },
  paladin:   { code: "paladin",   name: "Паладин",   race: "human", building: "stable",       buildingMin: 3, cost: { wood: 370, stone: 270, iron: 290, food: 120 }, upkeep: 4, pop: 2, atk: 180, defInf: 80, defCav: 105,speed: 9,  carry: 110, trainSeconds: 400 },
  djinn:     { code: "djinn",     name: "Джин",      race: "human", building: "workshop",     buildingMin: 5, cost: { wood: 450, stone: 500, iron: 420, food: 250 }, upkeep: 6, pop: 3, atk: 300, defInf: 120,defCav: 120,speed: 8,  carry: 80,  trainSeconds: 800 },
};

// TODO: elves (Эльф-лучник, Танцующий, Скаут, Созидающая, Кентавр, Единорог, Энт)
//       dwarves (Топорщик, Арбалетчик, Жрец рун, Грифон, Защитник гор, Револьверщик, Йетти)
//       unique (Гигант, Катапульта, Око, Тень, Таран, Валькирия) — same shape, added next.
