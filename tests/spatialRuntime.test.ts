import assert from "node:assert/strict";
import { it } from "node:test";
import { VisibilityMask } from "@/systems/world/fovShadowcast";
import { FlowField } from "@/systems/world/flowField";
import { WorldContext } from "@/systems/world/worldContext";
import { LightGrid } from "@/systems/world/lightGrid";
import { ElementGrid } from "@/systems/world/elementGrid";
import { projectilePool } from "@/systems/combat/projectilePool";
import { MobPool } from "@/systems/combat/spawnRules";
const wall = (x: number, y: number) =>
	(Math.abs(x) <= 3 && y === 0) || (Math.abs(x) === 3 && y >= 0 && y <= 5);
it("八象限可见墙面并遮住后方；第二盏灯与开门独立更新", () => {
	for (const [dx, dy] of [
		[1, 0],
		[0, 1],
		[-1, 0],
		[0, -1],
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	]) {
		const mask = new VisibilityMask(8).compute(
			-4,
			2,
			(x, y) => x === -4 + dx && y === 2 + dy,
		);
		assert.ok(mask.has(-4 + dx, 2 + dy));
		assert.equal(mask.has(-4 + 3 * dx, 2 + 3 * dy), false);
	}
	let closed = true;
	const grid = new LightGrid(16, (x, y) => closed && x === 1 && y === 0);
	const a = { id: "a", x: 8, y: 8, radius: 96 },
		b = { ...a, id: "b", x: 56 };
	grid.sync(0, [a, b]);
	assert.ok(grid.blockAt(3, 0) > 0);
	grid.sync(0, [a]);
	assert.equal(grid.blockAt(3, 0), 0);
	closed = false;
	grid.invalidate(1);
	assert.ok(grid.blockAt(3, 0) > 0);
});
it("追击者从 U 形内部绕行至玩家，运动包含半径碰撞", () => {
	const light = new LightGrid(16);
	const ctx = new WorldContext({
		tileSize: 16,
		light,
		terrain: {
			snowy: () => false,
			fireproof: () => false,
			flammable: () => true,
		},
		elements: new ElementGrid(16),
		solid: wall,
		opaque: wall,
		tuning: { brightCost: 2, fireCost: 12, hearingTiles: 2 },
	});
	const hero = { x: 8, y: -24 },
		actor = { x: 8, y: 40 },
		step = { x: 0, y: 0 };
	ctx.prepare(hero, 0);
	assert.equal(ctx.senses(actor, hero), false);
	let detour = false;
	for (let i = 0; i < 1600; i++) {
		const dx = hero.x - actor.x,
			dy = hero.y - actor.y,
			d = Math.hypot(dx, dy);
		if (d < 1) break;
		ctx.steer(actor, dx / d, dy / d, step);
		const x = actor.x + step.x,
			y = actor.y + step.y;
		for (const sx of [-6, 6])
			for (const sy of [-6, 6])
				assert.ok(!wall(Math.floor((x + sx) / 16), Math.floor((y + sy) / 16)));
		actor.x = x;
		actor.y = y;
		if (y >= 96) detour = true;
	}
	assert.ok(detour);
	assert.ok(Math.hypot(hero.x - actor.x, hero.y - actor.y) < 1);
});
it("32×32 加权流场单次重算耗时分布", (t) => {
	const field = new FlowField(),
		cost = (x: number, y: number) =>
			wall(x, y) ? 0 : 1 + (x % 4 === 0 ? 4 : 0);
	for (let i = 0; i < 100; i++) field.compute(0, -2, cost);
	const samples = [];
	for (let i = 0; i < 256; i++) {
		const start = performance.now();
		field.compute(0, -2, cost);
		samples.push(performance.now() - start);
	}
	samples.sort((a, b) => a - b);
	t.diagnostic(
		"ms p50=" +
			samples[128].toFixed(3) +
			" p95=" +
			samples[243].toFixed(3) +
			" max=" +
			samples[255].toFixed(3),
	);
	assert.ok(samples[255] < 1, `最慢一次流场重算为 ${samples[255].toFixed(3)} ms`);
});
it("1000 次对象池复用清除弹体目标、速度、生命和怪物可选状态", () => {
	const mobs = new MobPool<{ id: string; threat?: string }>();
	let previous;
	for (let i = 0; i < 1000; i++) {
		const p = projectilePool.acquire();
		if (previous) assert.equal(p, previous);
		assert.equal(p.targetId, undefined);
		assert.equal(p.lifeSec + p.vx + p.damage, 0);
		p.targetId = "old";
		p.vx = 12;
		p.damage = 3;
		p.lifeSec = 8;
		projectilePool.release(p);
		previous = p;
		const e = mobs.acquire({ id: "new" });
		assert.equal(e.threat, undefined);
		e.threat = "old";
		mobs.release(e);
	}
});
it("高火险绕行、同格玩家移动命中缓存、障碍版本触发重算", () => {
	let reads = 0,
		closed = false;
	const tuning = { brightCost: 0, fireCost: 16, hearingTiles: 1 };
	const elements = new ElementGrid(16);
	const terrain = {
		fireproof: () => false,
		flammable: () => true,
		snowy: () => false,
	};
	const world = new WorldContext({
		tileSize: 16,
		light: new LightGrid(16),
		elements,
		terrain,
		tuning,
		solid: (x, y) => {
			reads++;
			return closed && x === 1 && y === 0;
		},
		opaque: () => false,
	});
	const player = { x: 8, y: 8 },
		enemy = { x: 40, y: 8 },
		out = { x: 0, y: 0 };
	world.prepare(player, 0);
	world.steer(enemy, -1, 0, out);
	assert.equal(out.x, -1);
	const first = reads;
	world.prepare({ x: 9, y: 8 }, 0);
	world.steer(enemy, -1, 0, out);
	assert.equal(reads, first);
	assert.ok(world.ignite(1, 0, []));
	world.steer(enemy, -1, 0, out);
	assert.ok(Math.abs(out.y) > 0);
	tuning.fireCost = 0;
	world.steer(enemy, -1, 0, out);
	assert.equal(out.x, -1);
	closed = true;
	world.prepare(player, 1);
	world.steer(enemy, -1, 0, out);
	assert.ok(Math.abs(out.y) > 0);
});
