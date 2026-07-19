// Minimal authoritative game server: a world of castles + a line-based JSON
// command interface. NOTE: this JSON protocol is a placeholder for development.
// The real fenix client speaks a binary protocol — a protocol adapter (future
// work, reverse-engineered from the decompiled client) will sit in front of
// this same game logic.
import net from "node:net";
import { randomUUID } from "node:crypto";
import { startingLevels } from "./buildings.js";
import { zeroResources, STORABLE, type Castle } from "./model.js";
import { build, foodUpkeep, popCap, popUsed, productionPerHour, storageCapacity, train, update, upgradeCost } from "./economy.js";

const world = new Map<string, Castle>(); // castleId -> Castle

function foundCastle(ownerId: string, name: string): Castle {
  const c: Castle = {
    id: randomUUID().slice(0, 8),
    ownerId,
    name,
    levels: startingLevels(),
    army: {},
    stock: { ...zeroResources(), wood: 500, stone: 500, iron: 500, food: 500 },
    lastUpdate: Date.now(),
  };
  world.set(c.id, c);
  return c;
}

function stateOf(c: Castle) {
  update(c);
  return {
    id: c.id,
    name: c.name,
    levels: c.levels,
    stock: Object.fromEntries(STORABLE.map((r) => [r, Math.round(c.stock[r])])),
    production: Object.fromEntries(STORABLE.map((r) => [r, Math.round(productionPerHour(c)[r])])),
    storageCap: Math.round(storageCapacity(c)),
    army: c.army,
    pop: { used: popUsed(c), cap: popCap(c) },
    foodUpkeep: Math.round(foodUpkeep(c)),
  };
}

/** Handle one JSON command object, return a JSON-serialisable reply. */
function handle(cmd: any): any {
  switch (cmd?.op) {
    case "found":
      return { ok: true, castle: stateOf(foundCastle(cmd.owner ?? "anon", cmd.name ?? "Столица")) };
    case "state": {
      const c = world.get(cmd.id);
      return c ? { ok: true, castle: stateOf(c) } : { ok: false, reason: "no_castle" };
    }
    case "build": {
      const c = world.get(cmd.id);
      if (!c) return { ok: false, reason: "no_castle" };
      const cost = upgradeCost(c, cmd.code);
      const res = build(c, cmd.code);
      return res.ok ? { ok: true, code: cmd.code, level: res.newLevel, cost, castle: stateOf(c) } : { ok: false, reason: res.reason };
    }
    case "train": {
      const c = world.get(cmd.id);
      if (!c) return { ok: false, reason: "no_castle" };
      const res = train(c, cmd.unit, cmd.n ?? 1);
      return res.ok ? { ok: true, unit: cmd.unit, count: res.count, castle: stateOf(c) } : { ok: false, reason: res.reason };
    }
    default:
      return { ok: false, reason: "unknown_op" };
  }
}

const PORT = Number(process.env.PORT ?? 7070);
const server = net.createServer((socket) => {
  let buf = "";
  socket.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let reply: any;
      try { reply = handle(JSON.parse(line)); }
      catch (e) { reply = { ok: false, reason: "bad_json" }; }
      socket.write(JSON.stringify(reply) + "\n");
    }
  });
});
server.listen(PORT, () => console.log(`kings-server (dev JSON) listening on :${PORT}`));
