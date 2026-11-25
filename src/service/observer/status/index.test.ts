import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readdir, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BoardResult, ObserverEvent, SessionLiveness } from "@/types/index.js";
import countCheckboxes from "@/util/countCheckboxes/index.js";
import scan from "@/util/scan/index.js";
import buildRails from "./buildRails/index.js";
import buildStatus from "./index.js";

vi.mock("./buildRails/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./buildRails/index.js")>();
	return { default: vi.fn(actual.default) };
});

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const MINUTE = 60 * 1000;

const SPEC = "---\nalignment: aligned\nintent: x\n---\n";
const PLAN = (status: string) =>
	`---\nstatus: ${status}\nintent: x\n---\n## Plan\n### 1. A\n- [x] a\n### 2. B\n- [ ] b\n`;
const SESSION = "---\nintent: work\n---\n## Where this cycle stopped\n";
const BOARD: BoardResult = { state: "unavailable", reason: "no-brain-path", detail: "none", hint: "set it" };

let root: string;

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	root = await mkdtemp(join(tmpdir(), "build-status-"));
});

afterEach(async () => {
	vi.useRealTimers();
	await rm(root, { recursive: true, force: true });
});

async function writeAide(relPath: string, text: string): Promise<void> {
	const full = join(root, relPath);
	await mkdir(dirname(full), { recursive: true });
	await writeFile(full, text);
}

function iso(msBeforeNow: number): string {
	return new Date(NOW - msBeforeNow).toISOString();
}

function makeEvent(
	kind: ObserverEvent["kind"],
	fields: Record<string, unknown>,
	envelope: { sessionId?: string; seq?: number; ts?: string } = {},
): ObserverEvent {
	return { v: 1, ts: iso(MINUTE), sessionId: "s1", seq: 1, pid: 100, kind, ...fields, ...envelope } as ObserverEvent;
}

function makeLiveness(state: SessionLiveness["state"] = "working"): SessionLiveness {
	return { state, lastActivityAt: iso(MINUTE), quietMinutes: 1, maybeStuck: false };
}

/** Builds the status for the temp project; every session in the events is `working` unless `liveness` says otherwise. */
function run({
	events,
	archivedEvents = [],
	liveness,
}: {
	events: ObserverEvent[];
	archivedEvents?: ObserverEvent[];
	liveness?: Record<string, SessionLiveness>;
}) {
	const given = liveness ?? Object.fromEntries(events.map((event) => [event.sessionId, makeLiveness()]));
	return buildStatus({ projectRoot: root, events, archivedEvents, liveness: given, board: BOARD });
}

/** Every file's path, size and mtime under the root, for before/after comparison. */
async function snapshot(dir: string, base = ""): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) out.push(...(await snapshot(join(dir, entry.name), rel)));
		else {
			const info = await stat(join(dir, entry.name));
			out.push(`${rel}|${info.size}|${info.mtimeMs}`);
		}
	}
	return out.sort();
}

async function writeFullProject(planStatus = "approved"): Promise<void> {
	await writeAide(".aide/intent.aide", SPEC);
	await writeAide(".aide/session.aide", SESSION);
	await writeAide(".aide/config/brain.aide", "launcher: x\n");
	await writeAide("src/a/.aide", SPEC);
	await writeAide("src/a/brief.aide", "---\nstatus: approved\n---\nbody\n");
	await writeAide("src/a/plan.aide", PLAN(planStatus));
	await writeAide("src/a/todo.aide", "---\nstatus: proposed\n---\n- [ ] fix\n");
}

describe("buildStatus", () => {
	it("shows every file in the tree with its alignment or status and progress", async () => {
		await writeFullProject();

		const status = await run({ events: [] });

		const scanned = await scan(root);
		const entries = status.tree.flatMap((node) => node.files);
		expect(entries).toHaveLength(scanned.files.length);
		const plan = entries.find((entry) => entry.file === "src/a/plan.aide");
		expect(plan?.kind === "plan" && plan.read.state === "present" && plan.read.status).toBe("approved");
		const spec = entries.find((entry) => entry.file === "src/a/.aide");
		expect(spec?.kind === "intent" && spec.read.state === "present" && spec.read.alignment).toBe("aligned");
		expect(status.workFiles.map((entry) => entry.file)).toEqual(["src/a/plan.aide", "src/a/todo.aide"]);
		expect(status.problems).toEqual([]);
	});

	it("drops a Build entry when the plan file is proposed, while history keeps the event", async () => {
		await writeFullProject("proposed");
		const events = [makeEvent("phase_started", { phase: "build", agent: "aide-implementor", module: "src/a" })];

		const status = await run({ events });

		expect(status.running).toEqual([]);
		expect(status.history).toHaveLength(1);
		expect(status.history[0]?.kind).toBe("phase_started");
	});

	it("surfaces a proposed file only while the file awaits approval and no gate resolved it", async () => {
		await writeFullProject("proposed");
		const waiting = makeEvent("gate_waiting", { gate: "plan approval", file: "src/a/plan.aide" }, { seq: 1 });

		const proposed = await run({ events: [waiting] });
		expect(proposed.surfaced?.file).toBe("src/a/plan.aide");
		expect(proposed.waiting).toHaveLength(1);

		await writeAide("src/a/plan.aide", PLAN("approved"));
		const approved = await run({ events: [waiting] });
		expect(approved.surfaced).toBeNull();

		await writeAide("src/a/plan.aide", PLAN("proposed"));
		const resolved = makeEvent("gate_resolved", { gate: "plan approval", file: "src/a/plan.aide" }, { seq: 2 });
		const cleared = await run({ events: [waiting, resolved] });
		expect(cleared.surfaced).toBeNull();

		const missing = makeEvent("gate_waiting", { gate: "plan approval", file: "src/gone/plan.aide" });
		const gone = await run({ events: [missing] });
		expect(gone.surfaced).toBeNull();
		expect(gone.problems).toEqual([]);
	});

	it("matches each plan and todo progress to the shared checkbox counter", async () => {
		await writeFullProject();

		const status = await run({ events: [] });

		expect(status.workFiles).toHaveLength(2);
		for (const entry of status.workFiles) {
			const content = await readFile(join(root, entry.file), "utf8");
			expect(entry.read.state === "present" && entry.read.progress.open).toBe(countCheckboxes(content).open.length);
		}
	});

	describe("isolation", () => {
		it("marks only the file with broken YAML as malformed", async () => {
			await writeFullProject();
			await writeAide("src/a/todo.aide", "---\nstatus: [oops\n---\n- [ ] fix\n");
			const events = [makeEvent("prompt", { text: "hello" })];

			const status = await run({ events });

			const entries = status.tree.flatMap((node) => node.files);
			const malformed = entries.filter((entry) => entry.read.state === "malformed");
			expect(malformed.map((entry) => entry.file)).toEqual(["src/a/todo.aide"]);
			expect(status.sessions).toHaveLength(1);
			expect(status.history).toHaveLength(1);
			expect(status.board).toBe(BOARD);
		});

		it("reports a missing session record and keeps everything else", async () => {
			await writeFullProject();
			await rm(join(root, ".aide/session.aide"));

			const status = await run({ events: [] });

			expect(status.sessionRecord).toEqual({ state: "missing" });
			expect(status.tree.length).toBeGreaterThan(0);
		});

		it("returns empty event parts and a full tree for no events", async () => {
			await writeFullProject();

			const status = await run({ events: [] });

			expect(status.sessions).toEqual([]);
			expect(status.running).toEqual([]);
			expect(status.waiting).toEqual([]);
			expect(status.history).toEqual([]);
			expect(status.surfaced).toBeNull();
			expect(status.tree.flatMap((node) => node.files).length).toBeGreaterThan(0);
		});

		it("passes an unavailable board through unchanged", async () => {
			await writeFullProject();

			const status = await run({ events: [] });

			expect(status.board).toBe(BOARD);
			expect(status.generatedAt).toBe(new Date(NOW).toISOString());
		});
	});

	describe("pipeline rails", () => {
		it("builds one rail for a live session with finished phases, the running Build and its step", async () => {
			await writeFullProject();
			const events = [
				makeEvent("pipeline_started", { pipeline: "p1", phase: "spec" }, { seq: 1 }),
				makeEvent("phase_finished", { pipeline: "p1", phase: "spec", agent: "a", module: "src/a" }, { seq: 2 }),
				makeEvent("phase_finished", { pipeline: "p1", phase: "plan", agent: "a", module: "src/a" }, { seq: 3 }),
				makeEvent("phase_started", { pipeline: "p1", phase: "build", agent: "aide-implementor", module: "src/a" }, { seq: 4 }),
			];

			const status = await run({ events });

			expect(status.rails).toHaveLength(1);
			const [rail] = status.rails;
			expect(rail.sessionId).toBe("s1");
			expect(rail.pipeline).toBe("p1");
			expect(rail.pipelineState).toBe("running");
			const byPhase = Object.fromEntries(rail.stages.map((stage) => [stage.phase, stage]));
			expect(byPhase.spec?.state).toBe("done");
			expect(byPhase.plan?.state).toBe("done");
			expect(byPhase.build?.state).toBe("running");
			expect(byPhase.build?.buildStep).toEqual({ reached: 2, total: 2 });
			expect(byPhase.qa?.state).toBe("pending");
		});

		it("resumes the pipeline from an archived session's events", async () => {
			await writeFullProject();
			const archivedEvents = [
				makeEvent("phase_finished", { pipeline: "p1", phase: "spec", agent: "a", module: "src/a" }, { sessionId: "old", seq: 1, ts: iso(120 * MINUTE) }),
			];
			const events = [makeEvent("pipeline_started", { pipeline: "p1", phase: "plan" }, { seq: 1 })];

			const status = await run({ events, archivedEvents });

			expect(status.rails[0]?.stages.find((stage) => stage.phase === "spec")?.state).toBe("done");
			expect(status.sessions.map((session) => session.sessionId)).toEqual(["s1"]);
			expect(status.history).toHaveLength(1);
		});

		it("gives an ended session no rail", async () => {
			await writeFullProject();
			const events = [makeEvent("pipeline_started", { pipeline: "p1", phase: "spec" })];

			const status = await run({ events, liveness: { s1: makeLiveness("ended") } });

			expect(status.rails).toEqual([]);
			expect(status.sessions[0]?.liveness.state).toBe("ended");
		});

		it("has no rails without events", async () => {
			await writeFullProject();

			const status = await run({ events: [] });

			expect(status.rails).toEqual([]);
		});

		it("empties only the rails when buildRails throws", async () => {
			await writeFullProject("proposed");
			const events = [makeEvent("gate_waiting", { gate: "plan approval", file: "src/a/plan.aide" })];
			const baseline = await run({ events });
			vi.mocked(buildRails).mockImplementationOnce(() => {
				throw new Error("rail broke");
			});

			const status = await run({ events });

			expect(status.rails).toEqual([]);
			expect(status.problems).toEqual([{ part: "rail", message: "rail broke" }]);
			expect(status.tree).toEqual(baseline.tree);
			expect(status.sessions).toEqual(baseline.sessions);
			expect(status.running).toEqual(baseline.running);
			expect(status.waiting).toEqual(baseline.waiting);
			expect(status.surfaced).toEqual(baseline.surfaced);
			expect(status.history).toEqual(baseline.history);
		});
	});

	describe("no invention", () => {
		it("lists one history row per event and nothing waiting without a gate event", async () => {
			await writeFullProject("proposed");
			const events = [
				makeEvent("prompt", { text: "go" }, { seq: 1 }),
				makeEvent("commit", { sha: "abcdef1234" }, { seq: 3 }),
			];

			const status = await run({ events });

			expect(status.history).toHaveLength(events.length);
			expect(status.waiting).toEqual([]);
			expect(status.surfaced).toBeNull();
		});

		it("never marks a phase done without a matching phase_finished event", async () => {
			await writeFullProject();
			const events = [makeEvent("phase_started", { phase: "build", agent: "aide-implementor", module: "src/a" })];

			const status = await run({ events });

			expect(status.rails[0]?.stages.filter((stage) => stage.state === "done")).toEqual([]);
		});
	});

	it("leaves the project untouched", async () => {
		await writeFullProject("proposed");
		const events = [makeEvent("gate_waiting", { gate: "plan approval", file: "src/a/plan.aide" })];
		const before = await snapshot(root);

		await run({ events });

		expect(await snapshot(root)).toEqual(before);
	});
});
