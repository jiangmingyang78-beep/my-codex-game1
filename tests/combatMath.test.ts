import assert from "node:assert/strict";
import test from "node:test";
import { ratio01, safeUnit } from "@/systems/combat/combatMath";

test("safeUnit normalizes safely and falls back for zero vectors", () => {
  assert.deepEqual(safeUnit(0, 0), { x: 1, y: 0 });
  assert.deepEqual(safeUnit(0, 0, 0, -1), { x: 0, y: -1 });
  const u = safeUnit(3, 4);
  assert.ok(Math.abs(u.x - 0.6) < 1e-6);
  assert.ok(Math.abs(u.y - 0.8) < 1e-6);
});

test("*Safety margin and boundary tailoring", () => {
  assert.equal(ratio01(5, 0), 0);
  assert.equal(ratio01(5, -2), 0);
  assert.equal(ratio01(-1, 10), 0);
  assert.equal(ratio01(15, 10), 1);
  assert.equal(ratio01(3, 10), 0.3);
});
