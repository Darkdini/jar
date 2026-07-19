// Core domain types for the Kings server (see design/DESIGN.md).

/** Storable/traded resources. `people` is a population CAP, not a stockpile. */
export type ResourceKey = "wood" | "stone" | "iron" | "food" | "gold";
export const STORABLE: ResourceKey[] = ["wood", "stone", "iron", "food"];

export type Resources = Record<ResourceKey, number>;

export function zeroResources(): Resources {
  return { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
}

export type BuildingCategory = "resource" | "infra" | "military" | "science" | "special";

export interface BuildingDef {
  code: string;
  name: string; // Russian in-game name
  category: BuildingCategory;
  maxLevel: number;
  /** Base build cost at level 1 (grows by COST_FACTOR per level). */
  baseCost: Partial<Resources>;
  /** If it produces a resource: which one, and base/hour at level 1. */
  produces?: { res: ResourceKey; basePerHour: number };
  /** If it adds storage capacity (warehouse). */
  storage?: boolean;
  /** If it houses population (adds to people cap): people per level. */
  housing?: number;
}

/** A player's castle: which buildings at which level, plus current stock. */
export interface Castle {
  id: string;
  ownerId: string;
  name: string;
  levels: Record<string, number>; // building code -> level (0 = not built)
  stock: Resources; // current wood/stone/iron/food/gold
  lastUpdate: number; // epoch ms
}
