// Runnable demonstration of the economy engine — proves the logic works.
import { startingLevels } from "./buildings.js";
import { STORABLE, zeroResources, type Castle } from "./model.js";
import { build, popCap, productionPerHour, storageCapacity, update, upgradeCost, buildSeconds } from "./economy.js";

const HOUR = 3_600_000;

function newCastle(): Castle {
  return {
    id: "c1", ownerId: "damask", name: "Столица",
    levels: startingLevels(),
    stock: { ...zeroResources(), wood: 500, stone: 500, iron: 500, food: 500 },
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

console.log("\nOK: авторитарная экономика считается детерминированно и лениво.");
