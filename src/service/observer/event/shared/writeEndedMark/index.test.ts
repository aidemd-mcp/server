import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";
import writeEndedMark from "./index.js";

const KEY = "alpha-3f9a2c";
const SESSION = "20261125T100000000Z-abc123";
const CLAUDE = "c1f0a2b3-1111-4222-8333-444455556666";

let appData: string;

function makeMark(overrides: Partial<EndedMark> = {}): EndedMark {
	return { v: 1, sessionId: SESSION, endedAt: "2026-11-25T10:00:00.000Z", endedBy: "hook", ...overrides };
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-write-ended-"));
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
	await mkdir(path.dirname(resolveEndedMark({ projectKey: KEY, id: SESSION })), { recursive: true });
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("writeEndedMark", () => {
	it("writes the mark and answers written", async () => {
		const mark = makeMark();

		expect(await writeEndedMark({ projectKey: KEY, mark })).toBe("written");

		const stored = JSON.parse(await readFile(resolveEndedMark({ projectKey: KEY, id: SESSION }), "utf-8"));
		expect(stored).toEqual(mark);
	});

	it("keys a Claude-id mark by its Claude session id", async () => {
		const mark = makeMark({ sessionId: undefined, claudeSessionId: CLAUDE, endedBy: "user" });
		delete (mark as { sessionId?: string }).sessionId;

		expect(await writeEndedMark({ projectKey: KEY, mark })).toBe("written");

		const stored = JSON.parse(await readFile(resolveEndedMark({ projectKey: KEY, id: CLAUDE }), "utf-8"));
		expect(stored.claudeSessionId).toBe(CLAUDE);
	});

	it("leaves the first mark untouched and answers exists on a second write", async () => {
		await writeEndedMark({ projectKey: KEY, mark: makeMark({ endedBy: "hook" }) });

		const second = await writeEndedMark({
			projectKey: KEY,
			mark: makeMark({ endedBy: "user", endedAt: "2026-11-25T11:00:00.000Z" }),
		});

		expect(second).toBe("exists");
		const stored = JSON.parse(await readFile(resolveEndedMark({ projectKey: KEY, id: SESSION }), "utf-8"));
		expect(stored.endedBy).toBe("hook");
		expect(stored.endedAt).toBe("2026-11-25T10:00:00.000Z");
	});

	it("throws for a mark that does not fit the schema and writes nothing", async () => {
		const bad = makeMark({ claudeSessionId: CLAUDE });

		await expect(writeEndedMark({ projectKey: KEY, mark: bad })).rejects.toThrow();
		await expect(readFile(resolveEndedMark({ projectKey: KEY, id: SESSION }), "utf-8")).rejects.toThrow();
	});

	it("propagates a write error other than EEXIST, such as a missing folder", async () => {
		await rm(path.dirname(resolveEndedMark({ projectKey: KEY, id: SESSION })), { recursive: true, force: true });

		await expect(writeEndedMark({ projectKey: KEY, mark: makeMark() })).rejects.toThrow(/ENOENT/);
	});
});
