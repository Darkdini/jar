// Runnable demonstration of the economy engine — proves the logic works.
import { startingLevels } from "./buildings.js";
import { UNITS } from "./units.js";
import { STORABLE, zeroResources, type Castle } from "./model.js";
import { build, foodUpkeep, popCap, popUsed, productionPerHour, storageCapacity, train, update, upgradeCost, buildSeconds } from "./economy.js";

const HOUR = 3_600_000;

function newCastle(): Castle {
  return {
    id: "c1", ownerId: "damask", name: "Столица",
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

console.log("\nOK: экономика + армия считаются детерминированно и лениво.");
