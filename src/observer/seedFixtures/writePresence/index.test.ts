import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as endedMarkSchema } from "@/service/observer/event/shared/endedMark/index.js";
import { schema as presenceSchema } from "@/service/observer/event/shared/presenceRecord/index.js";
import create from "@/util/runtimePaths/create/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import writePresence from "./index.js";
import type { FixtureSession } from "@/observer/seedFixtures/types/index.js";

const NOW = Date.parse("2026-11-23T12:00:00.000Z");
const SESSION_ID = "20261123T113000000Z-abc123";

let base: string;
let projectRoot: string;

beforeEach(async () => {
	base = await mkdtemp(join(tmpdir(), "aide-write-presence-"));
	projectRoot = join(base, "project");
	vi.stubEnv("LOCALAPPDATA", join(base, "appdata"));
	vi.stubEnv("XDG_STATE_HOME", join(base, "appdata"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(base, { recursive: true, force: true });
});

function makeSession(overrides: Partial<FixtureSession> = {}): FixtureSession {
	return {
		pid: "live",
		events: [
			{ offsetMin: 30, kind: "session_started" },
			{ offsetMin: 12, kind: "prompt", text: "Continue." },
		],
		...overrides,
	};
}

/** The project key the fixture project resolves to, with its folders created. */
async function projectKeyOf(): Promise<string> {
	return (await create({ projectRoot })).projectKey;
}

describe("writePresence", () => {
	it("writes the presence linked to the session, aged by minutesAgo, under a fixture Claude id", async () => {
		await writePresence({ projectRoot, session: makeSession({ presence: { state: "waiting", minutesAgo: 7 } }), sessionId: SESSION_ID, now: NOW });

		const projectKey = await projectKeyOf();
		const file = resolvePresenceFile({ projectKey, claudeSessionId: `fixture-${SESSION_ID}` });
		const presence = presenceSchema.parse(JSON.parse(await readFile(file, "utf-8")));
		expect(presence).toMatchObject({
			claudeSessionId: `fixture-${SESSION_ID}`,
			sessionId: SESSION_ID,
			state: "waiting",
			hookEvent: "Stop",
			at: "2026-11-23T11:53:00.000Z",
		});
	});

	it.each([
		["working", "PostToolUse"],
		["waiting", "Stop"],
		["ended", "SessionEnd"],
	] as const)("records a %s presence from the %s hook", async (state, hookEvent) => {
		await writePresence({ projectRoot, session: makeSession({ presence: { state, minutesAgo: 1 } }), sessionId: SESSION_ID, now: NOW });

		const file = resolvePresenceFile({ projectKey: await projectKeyOf(), claudeSessionId: `fixture-${SESSION_ID}` });
		expect(JSON.parse(await readFile(file, "utf-8"))).toMatchObject({ state, hookEvent });
	});

	it("writes no ended mark for a presence, even an ended one, since the observer session is not ended by the hook", async () => {
		await writePresence({ projectRoot, session: makeSession({ presence: { state: "ended", minutesAgo: 1 } }), sessionId: SESSION_ID, now: NOW });

		const projectKey = await projectKeyOf();
		await expect(readFile(resolveEndedMark({ projectKey, id: SESSION_ID }), "utf-8")).rejects.toThrow();
	});

	it("writes a user ended mark stamped at the session's last event", async () => {
		await writePresence({ projectRoot, session: makeSession({ ended: true }), sessionId: SESSION_ID, now: NOW });

		const projectKey = await projectKeyOf();
		const mark = endedMarkSchema.parse(JSON.parse(await readFile(resolveEndedMark({ projectKey, id: SESSION_ID }), "utf-8")));
		expect(mark).toEqual({ v: 1, sessionId: SESSION_ID, endedAt: "2026-11-23T11:48:00.000Z", endedBy: "user" });
	});

	it("writes both the presence and the mark when a session carries both", async () => {
		await writePresence({
			projectRoot,
			session: makeSession({ presence: { state: "working", minutesAgo: 20 }, ended: true }),
			sessionId: SESSION_ID,
			now: NOW,
		});

		const projectKey = await projectKeyOf();
		expect(await readdir(join(resolveRoot().root, projectKey, "presence"))).toEqual([`fixture-${SESSION_ID}.json`]);
		expect(await readdir(join(resolveRoot().root, projectKey, "ended"))).toEqual([`${SESSION_ID}.json`]);
	});

	it("writes nothing for a session with neither field", async () => {
		await writePresence({ projectRoot, session: makeSession(), sessionId: SESSION_ID, now: NOW });

		const projectKey = await projectKeyOf();
		expect(await readdir(join(resolveRoot().root, projectKey, "presence"))).toEqual([]);
		expect(await readdir(join(resolveRoot().root, projectKey, "ended"))).toEqual([]);
	});
});
