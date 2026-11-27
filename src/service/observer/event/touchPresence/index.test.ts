import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import type { TouchPresenceInput } from "@/service/observer/event/types/index.js";
import touchPresence from "./index.js";

const markWrite = vi.hoisted(() => ({ failWith: null as Error | null }));

vi.mock("@/service/observer/event/shared/writeEndedMark/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/service/observer/event/shared/writeEndedMark/index.js")>();
	return {
		default: async (...args: Parameters<typeof actual.default>) => {
			if (markWrite.failWith !== null) throw markWrite.failWith;
			return actual.default(...args);
		},
	};
});

const CLAUDE = "claude-aaaa";
const OBSERVER = "20261125T100000000Z-abc123";

let appData: string;
let projectRoot: string;
let projectKey: string;
let presenceFile: string;

function makeInput(overrides: Partial<TouchPresenceInput> = {}): TouchPresenceInput {
	return {
		projectRoot,
		claudeSessionId: CLAUDE,
		hookEvent: "UserPromptSubmit",
		state: "working",
		at: "2026-11-25T10:00:10.000Z",
		endsObserverSession: false,
		...overrides,
	};
}

async function readStored(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(presenceFile, "utf-8"));
}

async function endedMarkNames(): Promise<string[]> {
	return readdir(path.dirname(resolveEndedMark({ projectKey, id: OBSERVER })));
}

beforeEach(async () => {
	markWrite.failWith = null;
	appData = await mkdtemp(path.join(tmpdir(), "aide-touch-presence-"));
	projectRoot = await mkdtemp(path.join(tmpdir(), "aide-touch-project-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	projectKey = resolve({ projectRoot }).projectKey;
	presenceFile = resolvePresenceFile({ projectKey, claudeSessionId: CLAUDE });
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
	await rm(projectRoot, { recursive: true, force: true });
});

describe("touchPresence", () => {
	it("creates the folders and the presence file on the first call", async () => {
		const outcome = await touchPresence(makeInput());

		expect(outcome).toEqual({ written: true, linkedSessionId: null, endedMark: "none", delivered: false, pinged: true });
		expect(await readStored()).toEqual({
			v: 1,
			claudeSessionId: CLAUDE,
			state: "working",
			at: "2026-11-25T10:00:10.000Z",
			hookEvent: "UserPromptSubmit",
		});
	});

	it("never lets an older hook overwrite a newer state, but still adds the link", async () => {
		await touchPresence(makeInput({ state: "waiting", hookEvent: "Stop", at: "2026-11-25T10:00:30.000Z" }));

		const outcome = await touchPresence(makeInput({ at: "2026-11-25T10:00:20.000Z", linkSessionId: OBSERVER }));

		expect(outcome.linkedSessionId).toBe(OBSERVER);
		expect(await readStored()).toMatchObject({
			state: "waiting",
			hookEvent: "Stop",
			at: "2026-11-25T10:00:30.000Z",
			sessionId: OBSERVER,
		});
	});

	it("fills the link when it arrives on a later call", async () => {
		await touchPresence(makeInput());

		await touchPresence(
			makeInput({ at: "2026-11-25T10:00:20.000Z", hookEvent: "PostToolUse", linkSessionId: OBSERVER }),
		);

		expect(await readStored()).toMatchObject({ sessionId: OBSERVER, hookEvent: "PostToolUse" });
	});

	it("keeps both observer ids when a second process's tagged reply links the same Claude session", async () => {
		const later = "20261125T110000000Z-fff999";
		await touchPresence(makeInput({ linkSessionId: OBSERVER }));

		await touchPresence(makeInput({ at: "2026-11-25T10:00:20.000Z", linkSessionId: later }));

		expect(await readStored()).toMatchObject({ sessionId: later, earlierSessionIds: [OBSERVER] });
	});

	it("keeps the transcript path when a later input lacks it", async () => {
		await touchPresence(makeInput({ transcriptPath: "/t/a.jsonl" }));

		await touchPresence(makeInput({ at: "2026-11-25T10:00:45.000Z" }));

		expect(await readStored()).toMatchObject({ transcriptPath: "/t/a.jsonl", at: "2026-11-25T10:00:45.000Z" });
	});

	it("treats a malformed existing file as none and replaces it", async () => {
		await touchPresence(makeInput());
		await writeFile(presenceFile, "{not json", "utf-8");

		const outcome = await touchPresence(makeInput({ at: "2026-11-25T10:00:20.000Z" }));

		expect(outcome.written).toBe(true);
		expect(outcome.pinged).toBe(true);
		expect(await readStored()).toMatchObject({ at: "2026-11-25T10:00:20.000Z" });
	});

	it("reports written false when the merge changes nothing", async () => {
		await touchPresence(makeInput());

		const outcome = await touchPresence(makeInput());

		expect(outcome).toEqual({ written: false, linkedSessionId: null, endedMark: "none", delivered: false, pinged: false });
	});

	it("writes the ended mark once for a linked SessionEnd that ends the observer session", async () => {
		await touchPresence(makeInput({ linkSessionId: OBSERVER }));
		const ending = makeInput({
			hookEvent: "SessionEnd",
			state: "ended",
			at: "2026-11-25T10:05:00.000Z",
			endsObserverSession: true,
		});

		const first = await touchPresence(ending);
		const second = await touchPresence(ending);

		expect(first.endedMark).toBe("written");
		expect(second.endedMark).toBe("exists");
		expect(await readStored()).toMatchObject({ state: "ended", hookEvent: "SessionEnd" });
		expect(JSON.parse(await readFile(resolveEndedMark({ projectKey, id: OBSERVER }), "utf-8"))).toEqual({
			v: 1,
			sessionId: OBSERVER,
			endedAt: "2026-11-25T10:05:00.000Z",
			endedBy: "hook",
		});
	});

	it("writes no mark for an unlinked SessionEnd", async () => {
		const outcome = await touchPresence(
			makeInput({ hookEvent: "SessionEnd", state: "ended", endsObserverSession: true }),
		);

		expect(outcome.endedMark).toBe("none");
		expect(await endedMarkNames()).toEqual([]);
	});

	it("writes presence ended and no mark when endsObserverSession is false", async () => {
		const outcome = await touchPresence(
			makeInput({ hookEvent: "SessionEnd", state: "ended", linkSessionId: OBSERVER, endsObserverSession: false }),
		);

		expect(outcome.endedMark).toBe("none");
		expect(await readStored()).toMatchObject({ state: "ended", sessionId: OBSERVER });
		expect(await endedMarkNames()).toEqual([]);
	});

	it("writes the file and reports delivered false when no observer runs", async () => {
		const outcome = await touchPresence(makeInput());

		expect(outcome.delivered).toBe(false);
		expect(outcome.written).toBe(true);
	});

	describe("with a running observer", () => {
		let server: Server;
		let presenceExistedOnPing: boolean[];

		beforeEach(async () => {
			presenceExistedOnPing = [];
			server = createServer(async (request, response) => {
				request.resume();
				presenceExistedOnPing.push(
					await readFile(presenceFile, "utf-8").then(
						() => true,
						() => false,
					),
				);
				response.statusCode = 202;
				response.end("{}");
			});
			await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
			const { root, observerFile } = resolveRoot();
			await mkdir(root, { recursive: true });
			await writeFile(
				observerFile,
				JSON.stringify({
					address: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
					token: "tok-1",
					pid: process.pid,
					version: "1.0.0",
				}),
			);
		});

		afterEach(async () => {
			await new Promise<void>((done) => server.close(() => done()));
		});

		it("still pings the observer and reports the failure when the ended-mark write fails", async () => {
			await touchPresence(makeInput({ linkSessionId: OBSERVER }));
			presenceExistedOnPing.length = 0;
			markWrite.failWith = new Error("disk full");

			const outcome = await touchPresence(
				makeInput({
					hookEvent: "SessionEnd",
					state: "ended",
					at: "2026-11-25T10:05:00.000Z",
					endsObserverSession: true,
				}),
			);

			expect(outcome).toEqual({
				written: true,
				linkedSessionId: OBSERVER,
				endedMark: "none",
				delivered: true,
				pinged: true,
				detail: "disk full",
			});
			expect(presenceExistedOnPing).toEqual([true]);
			expect(await readStored()).toMatchObject({ state: "ended", hookEvent: "SessionEnd" });
			expect(await endedMarkNames()).toEqual([]);
		});

		it("pings only after the presence file is on disk and reports delivered", async () => {
			const outcome = await touchPresence(makeInput());

			expect(outcome.delivered).toBe(true);
			expect(outcome.pinged).toBe(true);
			expect(presenceExistedOnPing).toEqual([true]);
		});

		it("leaves the file and the observer alone for a second working call 5 s later", async () => {
			await touchPresence(makeInput({ linkSessionId: OBSERVER, hookEvent: "UserPromptSubmit" }));
			const before = await readFile(presenceFile, "utf-8");
			presenceExistedOnPing.length = 0;

			const outcome = await touchPresence(
				makeInput({ linkSessionId: OBSERVER, hookEvent: "PostToolUse", at: "2026-11-25T10:00:15.000Z" }),
			);

			expect(outcome).toEqual({
				written: false,
				linkedSessionId: OBSERVER,
				endedMark: "none",
				delivered: false,
				pinged: false,
			});
			expect(await readFile(presenceFile, "utf-8")).toBe(before);
			expect(presenceExistedOnPing).toEqual([]);
		});

		it("refreshes and pings again once the stored time is 30 s old", async () => {
			await touchPresence(makeInput({ linkSessionId: OBSERVER }));
			presenceExistedOnPing.length = 0;

			const outcome = await touchPresence(
				makeInput({ linkSessionId: OBSERVER, hookEvent: "PostToolUse", at: "2026-11-25T10:00:41.000Z" }),
			);

			expect(outcome).toMatchObject({ written: true, pinged: true, delivered: true });
			expect(await readStored()).toMatchObject({ at: "2026-11-25T10:00:41.000Z", hookEvent: "PostToolUse" });
			expect(presenceExistedOnPing).toEqual([true]);
		});

		it("writes and pings for a Stop after working", async () => {
			await touchPresence(makeInput({ linkSessionId: OBSERVER }));
			presenceExistedOnPing.length = 0;

			const outcome = await touchPresence(
				makeInput({ state: "waiting", hookEvent: "Stop", at: "2026-11-25T10:00:12.000Z" }),
			);

			expect(outcome).toMatchObject({ written: true, pinged: true, delivered: true });
			expect(await readStored()).toMatchObject({ state: "waiting", hookEvent: "Stop" });
			expect(presenceExistedOnPing).toEqual([true]);
		});

		it("writes and pings when a link lands on a later call", async () => {
			await touchPresence(makeInput());
			presenceExistedOnPing.length = 0;

			const outcome = await touchPresence(makeInput({ at: "2026-11-25T10:00:12.000Z", linkSessionId: OBSERVER }));

			expect(outcome).toMatchObject({ written: true, pinged: true, linkedSessionId: OBSERVER });
			expect(presenceExistedOnPing).toEqual([true]);
		});

		it("writes ended presence, the mark and pings for a linked SessionEnd; a repeat does none of them", async () => {
			await touchPresence(makeInput({ linkSessionId: OBSERVER }));
			presenceExistedOnPing.length = 0;
			const ending = makeInput({
				hookEvent: "SessionEnd",
				state: "ended",
				at: "2026-11-25T10:00:20.000Z",
				endsObserverSession: true,
			});

			const first = await touchPresence(ending);
			const repeat = await touchPresence(ending);

			expect(first).toMatchObject({ written: true, endedMark: "written", pinged: true, delivered: true });
			expect(repeat).toMatchObject({ written: false, endedMark: "exists", pinged: false, delivered: false });
			expect(presenceExistedOnPing).toEqual([true]);
			expect(await readStored()).toMatchObject({ state: "ended" });
		});
	});

	it("writes nothing under the project root", async () => {
		await touchPresence(makeInput({ linkSessionId: OBSERVER }));
		await touchPresence(
			makeInput({
				hookEvent: "SessionEnd",
				state: "ended",
				at: "2026-11-25T10:09:00.000Z",
				endsObserverSession: true,
			}),
		);

		expect(await readdir(projectRoot)).toEqual([]);
	});

	it("resolves with written false and a detail for a bad Claude session id", async () => {
		const outcome = await touchPresence(makeInput({ claudeSessionId: "../escape" }));

		expect(outcome.written).toBe(false);
		expect(outcome.delivered).toBe(false);
		expect(outcome.detail).toMatch(/Invalid session id/);
	});

	it("never rejects when the filesystem fails", async () => {
		await mkdir(presenceFile, { recursive: true }); // a directory where the file belongs

		const outcome = await touchPresence(makeInput());

		expect(outcome.written).toBe(false);
		expect(outcome.delivered).toBe(false);
		expect(typeof outcome.detail).toBe("string");
	});
});
