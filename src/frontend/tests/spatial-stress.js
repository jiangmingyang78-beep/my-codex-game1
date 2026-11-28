// Playwright run-code. Use a fresh Chromium page and the Vite development server.
async (page, origin = "http://127.0.0.1:4179/") => {
	await page.addInitScript(() => {
		window.glCounts = { draw: 0, upload: 0 };
		for (const proto of [
			WebGLRenderingContext.prototype,
			WebGL2RenderingContext.prototype,
		]) {
			for (const [method, metric] of [
				["drawArrays", "draw"],
				["drawElements", "draw"],
				["texImage2D", "upload"],
				["texSubImage2D", "upload"],
			]) {
				const original = proto[method];
				proto[method] = function (...args) {
					window.glCounts[metric]++;
					return original.apply(this, args);
				};
			}
		}
	});
	await page.goto(origin);
	await page.locator('[data-ocid="title.adventure_button"]').click();
	await page.evaluate(async () => {
		const { Scenery } = await import("/src/game/world/Scenery.ts");
		const fn = Scenery.prototype.update;
		Scenery.prototype.update = function (state, ...args) {
			if (state.enemiesById)
				window.active = { scene: this.view.scene, state, fx: this.fx };
			return fn.call(this, state, ...args);
		};
	});
	await page.locator('[data-ocid="title.eternal_button"]').click();
	await page.waitForFunction(
		() =>
			window.active?.scene.sys.settings.key === "Game" ||
			window.active?.scene.sys.settings.key === "GameScene",
		{},
		{ timeout: 10000 },
	);
	const client = await page.context().newCDPSession(page);
	const trace = [];
	client.on("Tracing.dataCollected", ({ value }) => trace.push(...value));
	await client.send("Tracing.start", {
		categories: "blink.user_timing,devtools.timeline,v8",
		transferMode: "ReportEvents",
	});
	const measurements = await page.evaluate(async () => {
		const { scene, state, fx } = window.active,
			game = scene.game;
		const { skipEternalPrep } = await import(
			"/src/systems/eternal/eternalDirector.ts"
		);
		skipEternalPrep(state);
		for (let i = 0; i < 84; i++) {
			const x = state.hero.x + ((i % 12) - 5.5) * 11,
				y = state.hero.y + (Math.floor(i / 12) - 3) * 14;
			const id = "stress" + i;
			state.enemiesById[id] = {
				id,
				enemyId: "frost_rat",
				spawnId: "eternal",
				x,
				y,
				homeX: x,
				homeY: y,
				hp: 500,
				nightRound: 1,
				phase: "chase",
				phaseSec: 0,
				cooldownSec: 0,
				dirX: 1,
				dirY: 0,
				moveIndex: 0,
				hitDone: false,
				persistent: true,
			};
		}
		return await new Promise((resolve) => {
			let first;
			let n = 0,
				start = 0,
				old = 0;
			const render = [],
				interval = [];
			function begin() {
				start = performance.now();
				if (n === 40) {
					first = { ...window.glCounts };
					performance.mark("stress-start");
				}
				if (n >= 40) interval.push(start - old);
				old = start;
				state.hero.invulnerableSec = 10;
				fx.emitHit(state.hero.x, state.hero.y, { kind: "boss" });
			}
			function end() {
				if (n >= 40) render.push(performance.now() - start);
				if (++n === 180) {
					performance.mark("stress-end");
					game.events.off("prerender", begin);
					game.events.off("postrender", end);
					const stats = (a) => {
						a.sort((x, y) => x - y);
						return [
							a[Math.floor(a.length * 0.5)],
							a[Math.floor(a.length * 0.95)],
						];
					};
					resolve({
						drawPerFrame: (window.glCounts.draw - first.draw) / 140,
						uploadsPerFrame: (window.glCounts.upload - first.upload) / 140,
						webgl: !!game.renderer.gl,
						count: Object.keys(state.enemiesById).length,
						render: stats(render),
						frame: stats(interval),
					});
				}
			}
			game.events.on("prerender", begin).on("postrender", end);
		});
	});
	const completed = new Promise((resolve) =>
		client.once("Tracing.tracingComplete", resolve),
	);
	await client.send("Tracing.end");
	await completed;
	const start = trace.find((e) => e.name === "stress-start"),
		end = trace.find((e) => e.name === "stress-end");
	const gc = trace.filter(
		(e) =>
			e.pid === start.pid &&
			e.tid === start.tid &&
			e.ts >= start.ts &&
			e.ts < end.ts &&
			e.ph === "X" &&
			["MinorGC", "MajorGC"].includes(e.name),
	);
	return {
		...measurements,
		gcCount: gc.length,
		gcMs: gc.reduce((sum, e) => sum + e.dur / 1000, 0),
		maxGcMs: Math.max(0, ...gc.map((e) => e.dur / 1000)),
	};
};
