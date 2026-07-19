// Authoritative economy engine (see design/DESIGN.md §2-3).
import { BUILDINGS } from "./buildings.js";
import { STORABLE, type Castle, type Resources, type ResourceKey } from "./model.js";

// --- tunable constants (starter Travian-style values) ---
export const PROD_FACTOR = 1.163; // production growth per level
export const COST_FACTOR = 1.28; // build-cost growth per level
export const STORAGE_BASE = 800; // warehouse capacity at level 1
export const STORAGE_FACTOR = 1.28;
export const HOUSING_PER_LEVEL = 10;
export const BASE_BUILD_SECONDS = 30; // build time at level 1, before townhall speedup
export const BUILD_TIME_FACTOR = 1.28;

const lvl = (c: Castle, code: string) => c.levels[code] ?? 0;

/** Resource production per hour, summed over all producer buildings. */
export function productionPerHour(c: Castle): Resources {
  const p: Resources = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
  for (const code of Object.keys(c.levels)) {
    const def = BUILDINGS[code];
    const level = lvl(c, code);
    if (!def?.produces || level <= 0) continue;
    p[def.produces.res] += def.produces.basePerHour * Math.pow(PROD_FACTOR, level - 1);
  }
  return p;
}

/** Warehouse capacity (applies to wood/stone/iron/food). */
export function storageCapacity(c: Castle): number {
  let cap = 0;
  for (const code of Object.keys(c.levels)) {
    if (BUILDINGS[code]?.storage) cap += STORAGE_BASE * Math.pow(STORAGE_FACTOR, lvl(c, code) - 1);
  }
  return Math.max(cap, STORAGE_BASE);
}

/** Population capacity from housing buildings. */
export function popCap(c: Castle): number {
  let cap = 0;
  for (const code of Object.keys(c.levels)) {
    const h = BUILDINGS[code]?.housing;
    if (h) cap += h * lvl(c, code);
  }
  return cap;
}

/** Cost of upgrading `code` from its current level to the next. */
export function upgradeCost(c: Castle, code: string): Resources {
  const def = BUILDINGS[code];
  if (!def) throw new Error(`unknown building ${code}`);
  const nextLevel = lvl(c, code) + 1;
  const cost: Resources = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
  const mult = Math.pow(COST_FACTOR, nextLevel - 1);
  for (const [k, v] of Object.entries(def.baseCost)) cost[k as ResourceKey] = Math.round((v ?? 0) * mult);
  return cost;
}

export function buildSeconds(c: Castle, code: string): number {
  const nextLevel = lvl(c, code) + 1;
  const townhallSpeed = 1 + 0.05 * lvl(c, "townhall");
  return Math.round((BASE_BUILD_SECONDS * Math.pow(BUILD_TIME_FACTOR, nextLevel - 1)) / townhallSpeed);
}

/** Lazily advance the castle's stock to `now` (production + cap + upkeep). */
export function update(c: Castle, now = Date.now()): void {
  const dtHours = Math.max(0, (now - c.lastUpdate) / 3_600_000);
  if (dtHours === 0) return;
  const prod = productionPerHour(c);
  const cap = storageCapacity(c);
  for (const r of STORABLE) {
    c.stock[r] = Math.min(cap, c.stock[r] + prod[r] * dtHours);
  }
  // TODO: subtract army/population food upkeep once units exist.
  c.lastUpdate = now;
}

export type BuildResult = { ok: true; newLevel: number } | { ok: false; reason: string };

/** Attempt to upgrade a building: settle economy, check cost, deduct, apply. */
export function build(c: Castle, code: string, now = Date.now()): BuildResult {
  const def = BUILDINGS[code];
  if (!def) return { ok: false, reason: "unknown_building" };
  update(c, now);
  const current = lvl(c, code);
  if (current >= def.maxLevel) return { ok: false, reason: "max_level" };
  const cost = upgradeCost(c, code);
  for (const r of STORABLE) {
    if (c.stock[r] < cost[r]) return { ok: false, reason: `not_enough_${r}` };
  }
  for (const r of STORABLE) c.stock[r] -= cost[r];
  c.levels[code] = current + 1;
  return { ok: true, newLevel: c.levels[code] };
}
