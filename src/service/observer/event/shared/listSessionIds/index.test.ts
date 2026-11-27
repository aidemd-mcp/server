import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveArchivedLog from "@/util/runtimePaths/resolveArchivedLog/index.js";
import resolveSessionLog from "@/util/runtimePaths/resolveSessionLog/index.js";
import listSessionIds from "./index.js";

const KEY = "alpha-3f9a2c";
const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";
const C = "20261125T092000000Z-cccccc";

let appData: string;

async function put(file: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, "");
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-list-session-ids-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
});

describe("listSessionIds", () => {
	it("lists the events folder and the archive folder together, ascending and unique", async () => {
		await put(resolveSessionLog({ projectKey: KEY, sessionId: C }));
		await put(resolveSessionLog({ projectKey: KEY, sessionId: A }));
		await put(resolveArchivedLog({ projectKey: KEY, sessionId: B }));
		await put(resolveArchivedLog({ projectKey: KEY, sessionId: A }));

		expect(await listSessionIds({ projectKey: KEY })).toEqual([A, B, C]);
	});

	it("counts a missing folder as empty", async () => {
		await put(resolveArchivedLog({ projectKey: KEY, sessionId: B }));

		expect(await listSessionIds({ projectKey: KEY })).toEqual([B]);
		expect(await listSessionIds({ projectKey: "other-aaaaaa" })).toEqual([]);
	});

	it("skips a file whose stem is not a valid session id and one that is not a log", async () => {
		await put(resolveSessionLog({ projectKey: KEY, sessionId: A }));
		await put(path.join(path.dirname(resolveSessionLog({ projectKey: KEY, sessionId: A })), ".hidden.jsonl"));
		await put(path.join(path.dirname(resolveSessionLog({ projectKey: KEY, sessionId: A })), `${B}.txt`));

		expect(await listSessionIds({ projectKey: KEY })).toEqual([A]);
	});

	it("writes nothing", async () => {
		await listSessionIds({ projectKey: KEY });

		await expect(access(path.dirname(resolveSessionLog({ projectKey: KEY, sessionId: A })))).rejects.toThrow();
		await expect(access(path.dirname(resolveArchivedLog({ projectKey: KEY, sessionId: A })))).rejects.toThrow();
	});
});
