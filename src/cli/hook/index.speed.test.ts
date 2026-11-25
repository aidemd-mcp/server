import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import startObserver from "@/observer/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";

/**
 * Opt-in wall-clock check of the hook's speed budget (brief commitment #103, as amended 2026-11-25,
 * second fix loop). Skipped unless `AIDE_MEASURE_HOOK=1`, because wall time flakes on a loaded machine
 * or in CI.
 *
 * Run: `npm run build`, then `AIDE_MEASURE_HOOK=1 npx vitest run src/cli/hook/index.speed.test.ts`,
 * on an otherwise idle machine. Run it in QA for any plan that touches the hook's path
 * (`src/index.ts`, `src/cli/index.ts`, `src/cli/hook`, `event/touchPresence` and what it imports) and
 * before each publish.
 *
 * Before any timing, a child imports the built hook and prints the loaded builtins that must stay off
 * the path (undici, `worker_threads`, web readable streams). Then each phase runs 40 iterations of
 * one bare `node -e ""` and one `node dist/index.js hook` back to back, alternating which goes first,
 * and judges the median of the per-iteration difference (hook minus bare): pairing cancels slow drifts
 * in machine load and the median ignores spikes. The p95 of the differences is reported, not asserted.
 * A phase whose bare p95 exceeds twice its bare p50 is `inconclusive`: rerun it, never record it as a
 * pass. Every hook run must also stay under the hook's own 1 000 ms deadline.
 *
 * Children run against a temp app-data root and a temp project, with an observer started in this
 * process on a port the test frees itself: never the real per-user folder, never the real observer's
 * port. Children are spawned asynchronously (and timed with `process.hrtime.bigint()`) so the
 * in-process observer keeps answering their pings; a blocking spawn would stall it and charge every
 * ping its full timeout.
 */

const ITERATIONS = 40;
const QUIET_BUDGET_MS = 150;
const REFRESHING_BUDGET_MS = 180;
const DEADLINE_MS = 1_000;
const NOISE_RATIO = 2;
const CLAUDE = "claude-speed";
const OBSERVER_SESSION = "20261125T100000000Z-speed1";
const ENTRY = path.resolve(__dirname, "../../../dist/index.js");
const HOOK_MODULE = path.resolve(__dirname, "../../../dist/cli/hook/index.js");
const HEAVY_MODULES = /undici|worker_threads|internal\/webstreams\/readablestream/;

type Phase = { name: string; bare: number[]; hook: number[]; differences: number[]; budget: number };

let appData: string;
let projectRoot: string;
let presenceFile: string;
let stopObserver: (() => Promise<void>) | null = null;
const saved: Record<string, string | undefined> = {};

function childEnv(): NodeJS.ProcessEnv {
	return { ...process.env, LOCALAPPDATA: appData, XDG_STATE_HOME: appData, CLAUDE_PROJECT_DIR: projectRoot };
}

/** Wall time in ms from spawn to close of one child, with `stdin` piped in when given. */
function timeChild({ args, stdin }: { args: string[]; stdin?: string }): Promise<number> {
	return new Promise((done, fail) => {
		const started = process.hrtime.bigint();
		const child = spawn(process.execPath, args, { env: childEnv(), stdio: ["pipe", "ignore", "ignore"] });
		child.once("error", fail);
		child.once("close", () => done(Number(process.hrtime.bigint() - started) / 1e6));
		child.stdin.end(stdin ?? "");
	});
}

/** Runs one child to completion and returns what it printed on stdout. */
function captureChild(args: string[]): Promise<string> {
	return new Promise((done, fail) => {
		const child = spawn(process.execPath, args, { env: childEnv(), stdio: ["ignore", "pipe", "inherit"] });
		let out = "";
		child.stdout.on("data", (chunk) => (out += chunk));
		child.once("error", fail);
		child.once("close", () => done(out));
	});
}

function hookInput(overrides: Record<string, unknown>): string {
	return JSON.stringify({
		session_id: CLAUDE,
		hook_event_name: "PostToolUse",
		cwd: projectRoot,
		transcript_path: "/speed/transcript.jsonl",
		tool_name: "Bash",
		...overrides,
	});
}

function timeHook(overrides: Record<string, unknown> = {}): Promise<number> {
	return timeChild({ args: [ENTRY, "hook"], stdin: hookInput(overrides) });
}

function timeBare(): Promise<number> {
	return timeChild({ args: ["-e", ""] });
}

/** Drops the presence file and links the session again with one untimed call, so its `at` is fresh. */
async function seed(): Promise<string> {
	await rm(presenceFile, { force: true });
	await timeHook({
		tool_name: "mcp__aide__aide_observer_event",
		tool_response: { content: [{ type: "text", text: `{"logged":"written"}\n[observer-session ${OBSERVER_SESSION}]` }] },
	});
	return storedAt();
}

async function storedAt(): Promise<string> {
	return (JSON.parse(await readFile(presenceFile, "utf-8")) as { at: string }).at;
}

function percentile({ samples, p }: { samples: number[]; p: number }): number {
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[Math.ceil(p * sorted.length) - 1];
}

function median(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	const mid = sorted.length / 2;
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];
}

/**
 * Runs `ITERATIONS` paired iterations: one bare node and one hook call back to back, the order
 * alternating so neither side always runs first. `callHook` receives the iteration index.
 */
async function runPhase({
	name,
	budget,
	callHook,
}: {
	name: string;
	budget: number;
	callHook: (iteration: number) => Promise<number>;
}): Promise<Phase> {
	const phase: Phase = { name, bare: [], hook: [], differences: [], budget };
	for (let i = 0; i < ITERATIONS; i++) {
		let bare: number;
		let hook: number;
		if (i % 2 === 0) {
			bare = await timeBare();
			hook = await callHook(i);
		} else {
			hook = await callHook(i);
			bare = await timeBare();
		}
		phase.bare.push(bare);
		phase.hook.push(hook);
		phase.differences.push(hook - bare);
	}
	return phase;
}

function formatTable(phases: Phase[]): string {
	const cell = (value: number) => value.toFixed(0).padStart(10);
	const header = `${"phase (ms)".padEnd(40)}${"bare p50".padStart(10)}${"bare p95".padStart(10)}${"hook p50".padStart(10)}${"hook p95".padStart(10)}${"diff med".padStart(10)}${"diff p95".padStart(10)}`;
	const rows = phases.map(
		(phase) =>
			`${phase.name.padEnd(40)}${cell(median(phase.bare))}${cell(percentile({ samples: phase.bare, p: 0.95 }))}${cell(median(phase.hook))}${cell(percentile({ samples: phase.hook, p: 0.95 }))}${cell(median(phase.differences))}${cell(percentile({ samples: phase.differences, p: 0.95 }))}`,
	);
	return [`\nhook speed (${ITERATIONS} paired iterations per phase, ${process.platform}, node ${process.version})`, header, ...rows, ""].join("\n");
}

/** A TCP port that was free a moment ago: bind on 0, read it, close. */
function freePort(): Promise<number> {
	return new Promise((done, fail) => {
		const probe = createServer();
		probe.once("error", fail);
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address() as { port: number };
			probe.close(() => done(port));
		});
	});
}

describe.skipIf(process.env.AIDE_MEASURE_HOOK !== "1")("hook speed budget (brief commitment #103)", () => {
	beforeAll(async () => {
		if (!existsSync(ENTRY)) throw new Error(`${ENTRY} is missing: run \`npm run build\` before the speed test.`);
		appData = await mkdtemp(path.join(tmpdir(), "aide-speed-appdata-"));
		projectRoot = await mkdtemp(path.join(tmpdir(), "aide-speed-project-"));
		for (const name of ["LOCALAPPDATA", "XDG_STATE_HOME"]) {
			saved[name] = process.env[name];
			process.env[name] = appData;
		}
		presenceFile = resolvePresenceFile({ projectKey: resolve({ projectRoot }).projectKey, claudeSessionId: CLAUDE });
	});

	afterAll(async () => {
		await stopObserver?.();
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		await rm(appData, { recursive: true, force: true });
		await rm(projectRoot, { recursive: true, force: true });
	});

	it("loads no undici, worker_threads or web readable streams when the built hook is imported", async () => {
		const printed = await captureChild([
			"--input-type=module",
			"-e",
			`await import(${JSON.stringify(pathToFileURL(HOOK_MODULE).href)});` +
				`for (const name of process.moduleLoadList) if (/undici|worker_threads|internal\\/webstreams\\/readablestream/.test(name)) console.log(name);`,
		]);
		const loaded = printed.split("\n").filter((line) => HEAVY_MODULES.test(line));

		expect(
			loaded,
			"importing dist/cli/hook/index.js loaded builtins that cost every one-shot hook process: find the new static import (a dependency, or node:http as an ESM import) and load it with createRequire or drop it",
		).toEqual([]);
	}, 60_000);

	it("keeps the median overhead over a paired bare node start within budget", async () => {
		const stoppedSeedAt = await seed();
		const stoppedQuiet = await runPhase({
			name: "(b) observer stopped, quiet call",
			budget: QUIET_BUDGET_MS,
			callHook: () => timeHook(),
		});
		const stoppedAfterAt = await storedAt();

		const started = await startObserver({ port: await freePort() });
		if (started.outcome !== "started") throw new Error(`The test observer did not start: ${JSON.stringify(started)}`);
		stopObserver = started.stop;

		const runningSeedAt = await seed();
		const runningQuiet = await runPhase({
			name: "(c) observer running, quiet call",
			budget: QUIET_BUDGET_MS,
			callHook: () => timeHook(),
		});
		const runningAfterAt = await storedAt();

		let previousAt = runningAfterAt;
		let movedEveryRun = true;
		const runningRefresh = await runPhase({
			name: "(d) observer running, refreshing call",
			budget: REFRESHING_BUDGET_MS,
			callHook: async (iteration) => {
				const elapsed = await timeHook({ hook_event_name: iteration % 2 === 0 ? "Stop" : "PostToolUse" });
				const at = await storedAt();
				if (at === previousAt) movedEveryRun = false;
				previousAt = at;
				return elapsed;
			},
		});

		const phases = [stoppedQuiet, runningQuiet, runningRefresh];
		process.stdout.write(formatTable(phases));

		expect(stoppedAfterAt).toBe(stoppedSeedAt);
		expect(runningAfterAt).toBe(runningSeedAt);
		expect(movedEveryRun).toBe(true);

		for (const phase of phases) {
			const bareP50 = median(phase.bare);
			const bareP95 = percentile({ samples: phase.bare, p: 0.95 });
			expect(
				bareP95 <= NOISE_RATIO * bareP50,
				`inconclusive: machine too noisy (bare p50 ${bareP50.toFixed(0)} ms, p95 ${bareP95.toFixed(0)} ms); rerun on an idle machine`,
			).toBe(true);
			expect(Math.max(...phase.hook), `${phase.name}: a hook run exceeded the ${DEADLINE_MS} ms deadline`).toBeLessThan(DEADLINE_MS);
			expect(median(phase.differences), `${phase.name}: median overhead over a paired bare node start`).toBeLessThanOrEqual(phase.budget);
		}
	}, 600_000);
});
