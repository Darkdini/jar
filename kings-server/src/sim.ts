// Runnable demonstration of the economy engine — proves the logic works.
import { startingLevels } from "./buildings.js";
import { UNITS } from "./units.js";
import { STORABLE, zeroResources, type Castle, type Movement } from "./model.js";
import { build, foodUpkeep, popCap, popUsed, productionPerHour, storageCapacity, train, update, upgradeCost, buildSeconds } from "./economy.js";
import { armySpeed, distance, sendArmy, tickMovements, travelSeconds } from "./world.js";

const HOUR = 3_600_000;

function newCastle(): Castle {
  return {
    id: "c1", ownerId: "damask", name: "Столица", x: 500, y: 500,
    levels: startingLevels(),
    army: {},
    stock: { ...zeroResources(), wood: 2500, stone: 2500, iron: 2500, food: 2500 },
    lastUpdate: 0,
  };
}

function fmt(n: number) { return Math.round(n).toString().padStart(6); }
function line(c: Castle) {
  return STORABLE.map((r) => `${r}:${fmt(c.stock[r])}`).join("  ");
}

const c = newCastle();
console.log("=== Kings economy engine — simulation ===\n");
console.log("Старт замка:", c.name);
console.log("Здания:", Object.entries(c.levels).map(([k, v]) => `${k}=${v}`).join(", "));
console.log("Производство/час:", STORABLE.map((r) => `${r}:${Math.round(productionPerHour(c)[r])}`).join("  "));
console.log("Вместимость склада:", Math.round(storageCapacity(c)), " Население(кап):", popCap(c));
console.log("Ресурсы (t=0):     ", line(c));

// advance 3 hours of production
update(c, 3 * HOUR);
console.log("Ресурсы (t=3ч):    ", line(c));

// upgrade the woodcutter twice
for (let i = 0; i < 2; i++) {
  const cost = upgradeCost(c, "woodcutter");
  const secs = buildSeconds(c, "woodcutter");
  const res = build(c, "woodcutter", 3 * HOUR);
  console.log(
    res.ok
      ? `Построен Дровосек ур.${res.newLevel} (цена wood:${cost.wood} stone:${cost.stone} iron:${cost.iron} food:${cost.food}, ~${secs}с)`
      : `Не построить Дровосек: ${res.reason}`,
  );
}
console.log("Производство/час после апгрейда:", STORABLE.map((r) => `${r}:${Math.round(productionPerHour(c)[r])}`).join("  "));
console.log("Ресурсы после стройки:", line(c));

// advance 5 more hours, watch storage cap kick in
update(c, 8 * HOUR);
console.log("Ресурсы (t=8ч):    ", line(c), " (склад cap:", Math.round(storageCapacity(c)) + ")");

// try to overspend
const big = build(c, "traveler_house", 8 * HOUR);
console.log("Попытка Дом путешественника:", big.ok ? `ок ур.${big.newLevel}` : `отказ (${big.reason})`);

// --- army: build military buildings, then train units ---
console.log("\n--- Найм войск ---");
// need housing (population) + a barracks/stable first
for (let i = 0; i < 4; i++) build(c, "shack", 8 * HOUR);   // raise pop cap
build(c, "barracks", 8 * HOUR);
build(c, "stable", 8 * HOUR);
console.log("Построены: Хибара x4, Казарма, Конюшня");
console.log("Население:", popUsed(c) + "/" + popCap(c));
for (const [code, n] of [["swordman", 3], ["spearman", 2], ["knight", 1]] as [string, number][]) {
  const u = UNITS[code];
  const res = train(c, code, n, 8 * HOUR);
  console.log(res.ok
    ? `Нанято ${n}× ${u.name} (нужен ${u.building}≥${u.buildingMin}), теперь ${res.count}`
    : `Не нанять ${n}× ${u.name}: ${res.reason}`);
}
console.log("Армия:", Object.entries(c.army).map(([k, v]) => `${UNITS[k].name}:${v}`).join(", ") || "—");
console.log("Население:", popUsed(c) + "/" + popCap(c), " Расход еды:", Math.round(foodUpkeep(c)) + "/час");
console.log("Ресурсы после найма:", line(c));

// advance 4 hours: army eats food
update(c, 12 * HOUR);
console.log("Ресурсы (t=12ч, армия ест):", line(c), " (еда падает из-за содержания)");

// --- world map: movement + combat ---
console.log("\n--- Мировая карта: движение и бой ---");
// give our castle a real striking force
c.army = { swordman: 50, knight: 20 };
// an enemy castle nearby with a small garrison
const enemy: Castle = {
  id: "c2", ownerId: "bot", name: "Вражий замок", x: 505, y: 508,
  levels: { townhall: 1, warehouse: 1, fence: 2 },
  army: { spearman: 30 },
  stock: { ...zeroResources(), wood: 900, stone: 700, iron: 400, food: 600 },
  lastUpdate: 12 * HOUR,
};
const castles = new Map<string, Castle>([[c.id, c], [enemy.id, enemy]]);
const movements: Movement[] = [];

const d = distance(c, enemy).toFixed(1);
const strike = { swordman: 50, knight: 20 };
const eta = travelSeconds(c, enemy, strike);
console.log(`Дистанция ${c.name} → ${enemy.name}: ${d} клеток; скорость отряда ${armySpeed(strike)}/ч; в пути ~${(eta/3600).toFixed(2)} ч`);

const sent = sendArmy(castles, movements, c.id, enemy.id, "attack", strike, 12 * HOUR);
console.log("Отправка отряда:", sent.ok ? `ок (прибытие через ${((sent.movement.arriveAt-12*HOUR)/3600000).toFixed(2)} ч)` : `отказ (${sent.reason})`);

// jump to arrival and resolve
const arrivals = tickMovements(castles, movements, sent.ok ? sent.movement.arriveAt : 12 * HOUR);
for (const a of arrivals) {
  if (a.combat) {
    console.log(`Бой у ${enemy.name}: ${a.combat.attackerWins ? "АТАКА ПОБЕДИЛА" : "оборона выстояла"}`);
    console.log("  потери атакующего:", a.combat.attackerLosses, " потери обороны:", a.combat.defenderLosses);
    console.log("  добыча:", a.loot ? STORABLE.map((r)=>`${r}:${a.loot![r]}`).join(" ") : "—");
  }
}
console.log("Гарнизон врага после боя:", Object.entries(enemy.army).map(([k,v])=>`${UNITS[k].name}:${v}`).join(", ") || "разгромлен");
console.log("Движений в пути (возврат домой):", movements.length);

console.log("\nOK: экономика + армия + карта/бой считаются детерминированно и лениво.");
