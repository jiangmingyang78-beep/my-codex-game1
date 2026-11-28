import assert from "node:assert/strict";
import { it } from "node:test";
import { VisibilityMask } from "@/systems/world/fovShadowcast";
import { FlowField } from "@/systems/world/flowField";
import { WorldContext } from "@/systems/world/worldContext";
import { LightGrid } from "@/systems/world/lightGrid";
import { ElementGrid } from "@/systems/world/elementGrid";
import { projectilePool } from "@/systems/combat/projectilePool";
import { createParticleSimulation } from "@/vfx/particleSimulation.js";
import { acquireEnemy, enemyPool } from "@/systems/combat/spawnPopulation";
import { MobPool } from "@/systems/combat/spawnRules";
it("Remote light sources do not refresh local masks and are alert to the wall from within", () => {
	const grid = new LightGrid(16, (x, y) => x === 1 && y === 0);
	const ctx = new WorldContext({
		tileSize: 16,
		light: grid,
		solid: () => false,
		opaque: (x, y) => x === 1 && y === 0,
		elements: new ElementGrid(16),
		terrain: {
			fireproof: () => false,
			snowy: () => false,
			flammable: () => true,
		},
		tuning: { brightCost: 2, fireCost: 12, hearingTiles: 2 },
	});
	const hero = { x: 8, y: 8 };
	ctx.prepare(hero, 0);
	assert.equal(ctx.senses({ x: 40, y: 8 }, hero), true);
	assert.equal(ctx.senses({ x: 56, y: 8 }, hero), false);
	const base = grid.viewRevision(0, 0, 64, 64);
	grid.sync(0, [{ id: "far", x: 1024, y: 1024, radius: 20 }]);
	assert.equal(grid.viewRevision(0, 0, 64, 64), base);
	grid.sync(0, [{ id: "near", x: 8, y: 8, radius: 64 }]);
	assert.ok(grid.viewRevision(0, 0, 64, 64) > base);
	assert.equal(grid.blockAt(2, 0), 0);
});
it("The partial repair is at the same cost as the passage of the complete Dijkâna", () => {
	const costs = new Uint8Array(12 * 12).fill(1);
	const read = (x: number, y: number) => costs[y * 12 + x];
	const incremental = new FlowField(12),
		reference = new FlowField(12);
	let seed = 43;
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed;
	};
	const distance = (field: FlowField, x: number, y: number) => {
		const out = { x, y };
		let total = 0;
		for (let n = 0; n < 144; n++) {
			if (out.x === 6 && out.y === 6) return total;
			if (!field.step(out.x, out.y, out)) return Infinity;
			total += read(out.x, out.y);
		}
		throw Error("There's a circuit ring");
	};
	for (let k = 0; k < 75; k++) {
		const i = random() % 144;
		if (i !== 78) costs[i] = [0, 1, 12][random() % 3];
		incremental.update(6, 6, read);
		reference.compute(6, 6, read);
		for (let i = 0; i < 144; i++)
			assert.equal(
				distance(incremental, i % 12, Math.floor(i / 12)),
				distance(reference, i % 12, Math.floor(i / 12)),
			);
	}
});
it("/ / / Sub-combat entity, spark and impact ring re-entry complete", () => {
	const context = {
		createRadialGradient: () => ({ addColorStop() {} }),
		fillRect() {},
	};
	const sim = createParticleSimulation({
		maxParticles: 1,
		random: () => 0.5,
		createCanvas: () => ({ getContext: () => context }),
	});
	let lastParticle, lastRing, lastEnemy;
	for (let i = 0; i < 1000; i++) {
		const enemy = acquireEnemy("e", "frost_rat", "raid", 5, 7, 4, 1);
		if (i) assert.equal(enemy, lastEnemy);
		assert.equal(enemy.targetId, undefined);
		assert.equal(enemy.hurtTimer, undefined);
		assert.equal(enemy.taskLocked, undefined);
		assert.equal(enemy.phase, "idle");
		enemy.targetId = "player";
		enemy.hurtTimer = 3;
		enemy.taskLocked = true;
		lastEnemy = enemy;
		enemyPool.release(enemy);
		sim.impact(i, i, "boss");
		const particle = sim.particles[0],
			ring = sim.rings[0];
		if (i) {
			assert.equal(particle, lastParticle);
			assert.equal(ring, lastRing);
		}
		assert.equal(ring.x, i);
		assert.equal(ring.age, 0);
		assert.equal(particle.x, i);
		assert.equal(particle.dx, 0);
		assert.equal(particle.amb, 0);
		assert.equal(particle.life, 0.12);
		particle.dx = 123;
		lastParticle = particle;
		lastRing = ring;
		sim.update(0.5);
		assert.equal(sim.particles.length + sim.rings.length, 0);
	}
});
it("Several chasers bypass the tree barrier from the same point and pass through a wide passage", () => {
	const solid = (x: number, y: number) => x === 0 && y !== 1;
	const hero = { x: 72, y: 8 },
		out = { x: 0, y: 0 };
	const ctx = new WorldContext({
		tileSize: 16,
		light: new LightGrid(16),
		elements: new ElementGrid(16),
		solid,
		opaque: solid,
		terrain: {
			fireproof: () => false,
			flammable: () => true,
			snowy: () => false,
		},
		tuning: { brightCost: 0, fireCost: 0, hearingTiles: 2 },
	});
	ctx.prepare(hero, 0);
	const actors = Array.from({ length: 16 }, (_, id) => ({ id, x: -72, y: 8 }));
	let spread = false;
	for (let frame = 0; frame < 600; frame++) {
		ctx.clearCrowd();
		for (const a of actors) ctx.addActor(a);
		for (const a of actors) {
			const dx = hero.x - a.x,
				dy = hero.y - a.y,
				dist = Math.hypot(dx, dy);
			if (dist <= 1) continue;
			ctx.steer(a, dx / dist, dy / dist, out);
			const clear = (x: number, y: number) =>
				[-5, 5].every((sx) =>
					[-5, 5].every(
						(sy) =>
							!solid(Math.floor((x + sx) / 16), Math.floor((y + sy) / 16)),
					),
				);
			if (clear(a.x + out.x, a.y)) a.x += out.x;
			if (clear(a.x, a.y + out.y)) a.y += out.y;
		}
		if (Math.abs(actors[0].y - actors[1].y) > 0.5) spread = true;
	}
	assert.ok(spread);
	assert.ok(actors.every((a) => Math.hypot(a.x - hero.x, a.y - hero.y) <= 1));
});
const wall = (x: number, y: number) =>
	(Math.abs(x) <= 3 && y === 0) || (Math.abs(x) === 3 && y >= 0 && y <= 5);
it("Eight quadrants were visible and covered the rear; the second light and the door were independently updated", () => {
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
it("The pursuer goes from an inner U-shaped orbit to a player, and the movement consists of a radius collision", () => {
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
it("32 x 32 Weighted flow field single-time recalculations", (t) => {
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
	assert.ok(
		samples[255] < 1,
		`The slowest run is counted ${samples[255].toFixed(3)} ms`,
	);
});
it("The sub-object pool is resumed to clear the object, speed, life and monster options", () => {
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
it("High fire risk bypasses, peer player mobile life buffers, and the barrier version triggers a recalculation", () => {
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
