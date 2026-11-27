import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

const { mockTakeOver, mockTryBind, mockLaunch, mockAwait, mockVersion, mockMoveHistory, mockMoveRoot } = vi.hoisted(() => ({
	mockMoveHistory: vi.fn(),
	mockMoveRoot: vi.fn(),
	mockTakeOver: vi.fn(),
	mockTryBind: vi.fn(),
	mockLaunch: vi.fn(),
	mockAwait: vi.fn(),
	mockVersion: vi.fn(),
}));

vi.mock("@/observer/takeOver/index.js", () => ({ default: mockTakeOver }));
vi.mock("@/tools/observer/shared/tryBind/index.js", () => ({ default: mockTryBind }));
vi.mock("@/util/readPackageVersion/index.js", () => ({ default: mockVersion }));
vi.mock("./moveLegacyHistory/index.js", () => ({ default: mockMoveHistory }));
vi.mock("@/util/runtimePaths/moveLegacyRoot/index.js", () => ({ default: mockMoveRoot }));
vi.mock("./launchObserver/index.js", () => ({ default: mockLaunch }));
vi.mock("./awaitObserver/index.js", () => ({ default: mockAwait }));

import { homedir } from "node:os";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import start, { ObserverStartInput } from "./index.js";
import formatReply from "./formatReply/index.js";

const root = process.cwd();
const input = { root, entryScript: "/pkg/dist/index.js" };
const observer = { address: "http://127.0.0.1:24680", port: 24680, token: "tok", pid: 9, version: "0.15.0" };

function viewLink(address = observer.address, token = observer.token): string {
	const { projectKey } = resolve({ projectRoot: root });
	return `${address}/p/${encodeURIComponent(projectKey)}/s/${encodeURIComponent(getSession().sessionId)}?token=${token}`;
}

let home: string;
let appData: string;

/** Writes one recorded session of this project into the temp app-data root, `minutesAgo` quiet. */
async function writeOtherSession(sessionId: string, { minutesAgo, v = 2 }: { minutesAgo: number; v?: 1 | 2 }) {
	const ts = new Date(Date.now() - minutesAgo * 60_000).toISOString();
	const base = { v, ts, sessionId, pid: 4242 };
	const events =
		v === 2
			? [
					{ ...base, seq: 1, kind: "session_started" },
					{ ...base, seq: 2, kind: "pipeline_started", pipeline: "feature-x", phase: "build" },
					{ ...base, seq: 3, kind: "phase_started", pipeline: "feature-x", phase: "build", agent: "a", module: "src/x" },
				]
			: [{ ...base, seq: 1, kind: "session_started" }];
	const file = resolveEventLog({ projectRoot: root, sessionId });
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf-8");
}

async function writePresence(claudeSessionId: string, fields: Record<string, unknown> = {}) {
	const { projectKey } = resolve({ projectRoot: root });
	const file = resolvePresenceFile({ projectKey, claudeSessionId });
	await mkdir(path.dirname(file), { recursive: true });
	const presence = {
		v: 1,
		claudeSessionId,
		state: "working",
		at: new Date().toISOString(),
		hookEvent: "PostToolUse",
		...fields,
	};
	await writeFile(file, JSON.stringify(presence), "utf-8");
}

beforeEach(async () => {
	vi.clearAllMocks();
	home = await mkdtemp(path.join(tmpdir(), "aide-start-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-start-appdata-"));
	vi.mocked(homedir).mockReturnValue(home);
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	vi.stubEnv("AIDE_OBSERVER_PORT", "");
	mockVersion.mockReturnValue("0.15.0");
	mockMoveHistory.mockResolvedValue(undefined);
	mockTryBind.mockResolvedValue({ ok: true });
	mockLaunch.mockReturnValue({ pid: 1 });
	mockAwait.mockResolvedValue({ outcome: "answered", observer });
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("ObserverStartInput", () => {
	it("takes no input and ignores an old port argument", () => {
		expect(ObserverStartInput.parse({})).toEqual({});
		expect(ObserverStartInput.parse({ port: 31000 })).toEqual({});
	});
});

describe("start", () => {
	it("starts when no observer runs, linking to this session's view", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "started", link: viewLink() });
		expect(mockTakeOver).toHaveBeenCalledWith({ version: "0.15.0" });
		expect(mockTryBind).toHaveBeenCalledWith(protocol.ports[0]);
		expect(mockLaunch).toHaveBeenCalledWith({ root, port: protocol.ports[0], entryScript: "/pkg/dist/index.js" });
		expect(mockAwait).toHaveBeenCalledWith({ port: protocol.ports[0], child: { pid: 1 } });
	});

	it("keeps a same-or-newer running observer, spawning nothing, and links to this session's view", async () => {
		const running = { ...observer, address: "http://127.0.0.1:31999", port: 31999, token: "other" };
		mockTakeOver.mockResolvedValue({ outcome: "kept", observer: running });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "running", link: viewLink(running.address, "other") });
		expect(mockTryBind).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("reports started with the replaced version when an older observer was replaced", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "replaced", previous: { ...observer, version: "0.14.0" } });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "started", link: viewLink(), replaced: "0.14.0" });
		expect(mockLaunch).toHaveBeenCalledTimes(1);
	});

	it("prefers the replaced observer's port over the resolved one", async () => {
		mockTakeOver.mockResolvedValue({
			outcome: "replaced",
			previous: { ...observer, version: "0.14.0", port: 31555 },
		});

		await start(input);

		expect(mockTryBind).toHaveBeenNthCalledWith(1, 31555);
		expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ port: 31555 }));
	});

	it("reports stuck with both versions and the old observer's link, walking no ports", async () => {
		const old = { ...observer, version: "0.14.0", address: "http://127.0.0.1:24681", port: 24681, token: "old" };
		mockTakeOver.mockResolvedValue({ outcome: "stuck", observer: old });

		const reply = await start(input);

		expect(reply).toEqual({
			outcome: "stuck",
			runningVersion: "0.14.0",
			ownVersion: "0.15.0",
			link: viewLink(old.address, "old"),
		});
		expect(mockTryBind).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("is blocked by an invalid AIDE_OBSERVER_PORT, naming it, probing and spawning nothing", async () => {
		vi.stubEnv("AIDE_OBSERVER_PORT", "abc");

		const reply = await start(input);

		expect(reply.outcome).toBe("blocked");
		expect(reply).toMatchObject({ reason: expect.stringContaining("AIDE_OBSERVER_PORT") });
		expect(reply).toMatchObject({ reason: expect.stringContaining('"abc"') });
		expect(mockTakeOver).not.toHaveBeenCalled();
		expect(mockTryBind).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("walks from the port in AIDE_OBSERVER_PORT when set", async () => {
		vi.stubEnv("AIDE_OBSERVER_PORT", "31000");
		mockTakeOver.mockResolvedValue({ outcome: "none" });

		await start(input);

		expect(mockTryBind).toHaveBeenNthCalledWith(1, 31000);
		expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ port: 31000 }));
	});

	it("gives the spawned view the next port when the first is busy", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockTryBind.mockResolvedValueOnce({ ok: false, reason: "in use" }).mockResolvedValue({ ok: true });

		const reply = await start(input);

		expect(reply.outcome).toBe("started");
		expect(mockLaunch).toHaveBeenCalledWith({ root, port: protocol.ports[1], entryScript: "/pkg/dist/index.js" });
		expect(mockAwait).toHaveBeenCalledWith({ port: protocol.ports[1], child: { pid: 1 } });
	});

	it("is blocked, naming every port and why, when none binds, spawning nothing", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockTryBind.mockImplementation(async (port: number) =>
			port === protocol.ports[2] ? { ok: false, reason: "not allowed" } : { ok: false, reason: "in use" },
		);

		const reply = await start(input);

		const named = protocol.ports
			.map((port) => `${port} (${port === protocol.ports[2] ? "not allowed" : "in use"})`)
			.join(", ");
		expect(protocol.ports).toHaveLength(10);
		expect(reply).toEqual({ outcome: "blocked", reason: `No port could be bound: ${named}` });
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("returns awaitObserver's not-started reply as blocked", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockAwait.mockResolvedValue({ outcome: "not-started", reason: "the observer did not answer" });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "blocked", reason: "the observer did not answer" });
	});

	it("turns a throwing launch into blocked with the message", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockLaunch.mockImplementation(() => {
			throw new Error("spawn failed");
		});

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "blocked", reason: "spawn failed" });
	});

	describe("the move of old-folder history", () => {
		it("runs once per start, before the observer check", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });

			await start(input);

			expect(mockMoveHistory).toHaveBeenCalledTimes(1);
			expect(mockMoveHistory.mock.invocationCallOrder[0]).toBeLessThan(mockTakeOver.mock.invocationCallOrder[0]);
		});

		it("still answers the usual reply when the move itself rejects", async () => {
			const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
			const actual = await vi.importActual<typeof import("./moveLegacyHistory/index.js")>("./moveLegacyHistory/index.js");
			mockMoveHistory.mockImplementation(actual.default);
			mockMoveRoot.mockRejectedValue(new Error("cannot list"));
			mockTakeOver.mockResolvedValue({ outcome: "none" });

			const reply = await start(input);

			expect(reply).toEqual({ outcome: "started", link: viewLink() });
			expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/^aide: could not move .*cannot list\n$/));
			stderr.mockRestore();
		});
	});

	describe("the HALT check", () => {
		const OTHER = "20261125T090000000Z-other0";
		const OLD_V1 = "20261125T080000000Z-oldv10";

		it("halts naming another working session's pipeline and phase, still carrying the link", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			await writeOtherSession(OTHER, { minutesAgo: 1 });

			const reply = await start(input);

			expect(reply).toMatchObject({ outcome: "halt", link: viewLink() });
			expect(reply).toMatchObject({
				open: [{ id: OTHER, idKind: "session", pipeline: "feature-x", phase: "build" }],
			});
		});

		it("halts a waiting session as waiting", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			await writeOtherSession(OTHER, { minutesAgo: 1 });
			await writePresence("claude-other", { sessionId: OTHER, state: "waiting" });

			const reply = await start(input);

			expect(reply).toMatchObject({ outcome: "halt", open: [{ id: OTHER, liveness: { state: "waiting" } }] });
			expect(formatReply(reply)).toContain(`- ${OTHER} · waiting on the user ·`);
		});

		it("halts a hookless v2 session and a v1 session, each 40 minutes quiet, as maybe stuck", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			await writeOtherSession(OLD_V1, { minutesAgo: 40, v: 1 });
			await writeOtherSession(OTHER, { minutesAgo: 40 });

			const reply = await start(input);

			expect(reply).toMatchObject({
				outcome: "halt",
				open: [
					{ id: OLD_V1, liveness: { quietMinutes: 40, maybeStuck: true } },
					{ id: OTHER, liveness: { quietMinutes: 40, maybeStuck: true } },
				],
			});
			expect(formatReply(reply)).toContain(`- ${OLD_V1} · working · quiet 40 min, maybe stuck ·`);
		});

		it("never halts for an ended session or the caller's own session", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			await writeOtherSession(OTHER, { minutesAgo: 1 });
			const { projectKey } = resolve({ projectRoot: root });
			const mark = resolveEndedMark({ projectKey, id: OTHER });
			await mkdir(path.dirname(mark), { recursive: true });
			const ended = { v: 1, sessionId: OTHER, endedAt: new Date().toISOString(), endedBy: "user" };
			await writeFile(mark, JSON.stringify(ended));
			await writeOtherSession(getSession().sessionId, { minutesAgo: 0 });

			const reply = await start(input);

			expect(reply).toEqual({ outcome: "started", link: viewLink() });
		});

		it("halts for an unlinked open presence, naming it by its Claude id", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			await writePresence("claude-lonely");

			const reply = await start(input);

			expect(reply).toMatchObject({
				outcome: "halt",
				open: [{ id: "claude-lonely", idKind: "claude", pipeline: null, phase: null }],
			});
			expect(formatReply(reply)).toContain("- claude:claude-lonely · working ·");
		});

		it("does not halt when the caller's own presence links late, 300 ms after start begins", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			await writePresence("claude-own");
			setTimeout(() => {
				void writePresence("claude-own", { sessionId: getSession().sessionId });
			}, 300);

			const begun = Date.now();
			const reply = await start(input);

			expect(reply).toEqual({ outcome: "started", link: viewLink() });
			expect(Date.now() - begun).toBeGreaterThanOrEqual(250);
		});

		it("halts from disk when the observer is kept or stuck, whatever it replayed", async () => {
			await writeOtherSession(OTHER, { minutesAgo: 1 });
			mockTakeOver.mockResolvedValue({ outcome: "kept", observer });
			expect(await start(input)).toMatchObject({ outcome: "halt", open: [{ id: OTHER }] });

			mockTakeOver.mockResolvedValue({ outcome: "stuck", observer: { ...observer, version: "0.14.0" } });
			expect(await start(input)).toMatchObject({ outcome: "halt", open: [{ id: OTHER }] });
		});

		it("reopens an ended caller conversation, answering REOPENED: before the link", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			const EARLIER = "20261125T070000000Z-earlie";
			await writeOtherSession(EARLIER, { minutesAgo: 120 });
			await writePresence("claude-own", { sessionId: getSession().sessionId, earlierSessionIds: [EARLIER] });
			const { projectKey } = resolve({ projectRoot: root });
			const mark = resolveEndedMark({ projectKey, id: EARLIER });
			await mkdir(path.dirname(mark), { recursive: true });
			await writeFile(mark, JSON.stringify({ v: 1, sessionId: EARLIER, endedAt: new Date().toISOString(), endedBy: "hook" }));

			const reply = await start(input);

			expect(reply).toEqual({ outcome: "reopened", reply: { outcome: "started", link: viewLink() } });
			expect(formatReply(reply).split("\n")[0]).toMatch(/^REOPENED: /);
		});

		it("is blocked, not passed, when the check itself fails", async () => {
			mockTakeOver.mockResolvedValue({ outcome: "none" });
			const { projectKey } = resolve({ projectRoot: root });
			const eventsFolder = path.dirname(resolveEventLog({ projectRoot: root, sessionId: OTHER }));
			await mkdir(path.dirname(eventsFolder), { recursive: true });
			// A file where the events folder belongs: listing it fails with ENOTDIR, not ENOENT.
			await writeFile(eventsFolder, "not a folder");

			const reply = await start(input);

			expect(reply.outcome).toBe("blocked");
		});
	});
});
