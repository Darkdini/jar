// World map, troop movement and combat.
//
// Movement model follows the classic Travian/Tribal-Wars approach used by
// planners like rafsaf/Tribal-Wars-Planer:
//   distance   = Euclidean between village coordinates
//   travelTime = distance / speed(slowest unit in the army)
//
// Combat follows design/DESIGN.md §5 (attack/defence by type, fence bonus).
import { randomUUID } from "node:crypto";
import { UNITS } from "./units.js";
import { STORABLE, zeroResources, type Castle, type Movement, type MoveKind, type Resources } from "./model.js";
import { update, storageCapacity } from "./economy.js";

export interface Point { x: number; y: number; }

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Slowest unit speed (cells/hour) in the army; empty army -> 0. */
export function armySpeed(army: Record<string, number>): number {
  let slow = Infinity;
  for (const [code, n] of Object.entries(army)) {
    if (n > 0 && UNITS[code]) slow = Math.min(slow, UNITS[code].speed);
  }
  return slow === Infinity ? 0 : slow;
}

export function travelSeconds(a: Point, b: Point, army: Record<string, number>): number {
  const sp = armySpeed(army);
  if (sp <= 0) return 0;
  return Math.max(1, Math.round((distance(a, b) / sp) * 3600));
}

function totalUnits(army: Record<string, number>): number {
  return Object.values(army).reduce((s, n) => s + n, 0);
}

// ---- combat (Travian-style) ----

export interface CombatResult {
  attackerWins: boolean;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  survivorsAtk: Record<string, number>;
  survivorsDef: Record<string, number>;
}

/** Resolve an attacking army against a defending garrison + fence bonus. */
export function resolveCombat(atk: Record<string, number>, def: Record<string, number>, fenceLevel: number): CombatResult {
  let attack = 0;
  for (const [code, n] of Object.entries(atk)) attack += (UNITS[code]?.atk ?? 0) * n;

  // Defence: average of inf/cav defence weighted by attacker composition is a
  // fine v1; use a simple blend of both defence types.
  let defence = 0;
  for (const [code, n] of Object.entries(def)) {
    const u = UNITS[code];
    if (u) defence += ((u.defInf + u.defCav) / 2) * n;
  }
  defence *= 1 + 0.05 * fenceLevel; // fence raises defence 5%/level

  const attackerWins = attack > defence;
  // Loss ratio: loser wiped proportionally; winner loses the inverse share.
  const ratio = attack + defence === 0 ? 0 : Math.min(attack, defence) / Math.max(attack, defence);
  const atkLossFrac = attackerWins ? Math.pow(ratio, 1.5) : 1;
  const defLossFrac = attackerWins ? 1 : Math.pow(ratio, 1.5);

  const attackerLosses = scale(atk, atkLossFrac);
  const defenderLosses = scale(def, defLossFrac);
  return {
    attackerWins,
    attackerLosses,
    defenderLosses,
    survivorsAtk: sub(atk, attackerLosses),
    survivorsDef: sub(def, defenderLosses),
  };
}

function scale(army: Record<string, number>, frac: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [c, n] of Object.entries(army)) out[c] = Math.round(n * frac);
  return out;
}
function sub(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [c, n] of Object.entries(a)) { const v = n - (b[c] ?? 0); if (v > 0) out[c] = v; }
  return out;
}
function addArmy(dst: Record<string, number>, src: Record<string, number>) {
  for (const [c, n] of Object.entries(src)) dst[c] = (dst[c] ?? 0) + n;
}

// ---- movement orchestration ----

export type SendResult = { ok: true; movement: Movement } | { ok: false; reason: string };

/** Send part of a castle's garrison to another castle. */
export function sendArmy(
  castles: Map<string, Castle>,
  movements: Movement[],
  fromId: string,
  toId: string,
  kind: MoveKind,
  army: Record<string, number>,
  now = Date.now(),
): SendResult {
  const from = castles.get(fromId);
  const to = castles.get(toId);
  if (!from || !to) return { ok: false, reason: "no_castle" };
  if (totalUnits(army) <= 0) return { ok: false, reason: "empty_army" };
  for (const [code, n] of Object.entries(army)) {
    if (!UNITS[code]) return { ok: false, reason: `unknown_unit_${code}` };
    if ((from.army[code] ?? 0) < n) return { ok: false, reason: `not_enough_${code}` };
  }
  // detach from garrison
  for (const [code, n] of Object.entries(army)) {
    from.army[code] -= n;
    if (from.army[code] <= 0) delete from.army[code];
  }
  const secs = travelSeconds(from, to, army);
  const mv: Movement = {
    id: randomUUID().slice(0, 8),
    fromId, toId, kind, army: { ...army },
    departAt: now, arriveAt: now + secs * 1000,
  };
  movements.push(mv);
  return { ok: true, movement: mv };
}

export interface Arrival {
  movement: Movement;
  combat?: CombatResult;
  loot?: Resources;
}

/** Process all movements that have arrived by `now`. Returns what happened. */
export function tickMovements(castles: Map<string, Castle>, movements: Movement[], now = Date.now()): Arrival[] {
  const arrivals: Arrival[] = [];
  const remaining: Movement[] = [];
  for (const mv of movements) {
    if (mv.arriveAt > now) { remaining.push(mv); continue; }
    const to = castles.get(mv.toId);
    if (!to) { arrivals.push({ movement: mv }); continue; }

    if (mv.kind === "return" || mv.kind === "support") {
      addArmy(to.army, mv.army);
      if (mv.loot) { update(to, mv.arriveAt); const cap = storageCapacity(to);
        for (const r of STORABLE) to.stock[r] = Math.min(cap, to.stock[r] + (mv.loot[r] ?? 0)); }
      arrivals.push({ movement: mv, loot: mv.loot });
    } else { // attack
      update(to, mv.arriveAt);
      const combat = resolveCombat(mv.army, to.army, to.levels["fence"] ?? 0);
      to.army = combat.survivorsDef;
      let loot: Resources | undefined;
      if (combat.attackerWins) {
        // loot up to carry capacity of surviving attackers
        let cap = 0;
        for (const [c, n] of Object.entries(combat.survivorsAtk)) cap += (UNITS[c]?.carry ?? 0) * n;
        loot = zeroResources();
        for (const r of STORABLE) {
          const take = Math.min(to.stock[r], cap / STORABLE.length);
          loot[r] = Math.round(take); to.stock[r] -= take;
        }
      }
      // survivors march home
      const from = castles.get(mv.fromId);
      if (from && totalUnits(combat.survivorsAtk) > 0) {
        const back = travelSeconds(to, from, combat.survivorsAtk);
        movements.push({
          id: randomUUID().slice(0, 8), fromId: mv.toId, toId: mv.fromId, kind: "return",
          army: combat.survivorsAtk, loot, departAt: mv.arriveAt, arriveAt: mv.arriveAt + back * 1000,
        });
      }
      arrivals.push({ movement: mv, combat, loot });
    }
  }
  movements.length = 0;
  movements.push(...remaining);
  return arrivals;
}
