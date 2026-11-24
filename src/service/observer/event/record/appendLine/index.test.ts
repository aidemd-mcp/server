import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => actual.homedir()) };
});

import { homedir } from "node:os";
import appendLine from "./index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

const mockHomedir = vi.mocked(homedir);

let home: string;
let appData: string;
let project: string;

function makeEvent(overrides: Partial<ObserverEvent> = {}): ObserverEvent {
	return {
		v: 1,
		ts: "2026-11-22T10:00:00.000Z",
		sessionId: "20261122T100000000Z-abc123",
		seq: 1,
		pid: 4242,
		kind: "release",
		version: "1.2.3",
		...overrides,
	} as ObserverEvent;
}

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "aide-append-home-"));
	appData = await mkdtemp(path.join(tmpdir(), "aide-append-appdata-"));
	project = await mkdtemp(path.join(tmpdir(), "aide-append-project-"));
	mockHomedir.mockReturnValue(home);
	vi.stubEnv("LOCALAPPDATA", appData);
	vi.stubEnv("XDG_STATE_HOME", appData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all([home, appData, project].map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("appendLine", () => {
	it("creates the events folder and writes exactly one line equal to the event JSON", async () => {
		const event = makeEvent();

		const result = await appendLine({ projectRoot: project, event });

		expect(result).toEqual({ written: true });
		const file = resolveEventLog({ projectRoot: project, sessionId: event.sessionId });
		expect(await readFile(file, "utf-8")).toBe(JSON.stringify(event) + "\n");
	});

	it("appends a second line to the same file", async () => {
		const first = makeEvent();
		const second = makeEvent({ seq: 2 });

		await appendLine({ projectRoot: project, event: first });
		await appendLine({ projectRoot: project, event: second });

		const file = resolveEventLog({ projectRoot: project, sessionId: first.sessionId });
		expect(await readFile(file, "utf-8")).toBe(`${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);
	});

	it("leaves the project folder empty", async () => {
		await appendLine({ projectRoot: project, event: makeEvent() });

		expect(await readdir(project)).toEqual([]);
	});

	it("returns written false with a detail when the events folder cannot be created", async () => {
		const paths = resolve({ projectRoot: project });
		await mkdir(paths.folder, { recursive: true });
		await writeFile(paths.eventsFolder, "not a folder");

		const result = await appendLine({ projectRoot: project, event: makeEvent() });

		expect(result.written).toBe(false);
		expect(result.written === false && result.detail.length).toBeGreaterThan(0);
	});

	it("returns written false for a relative project root without throwing", async () => {
		const result = await appendLine({ projectRoot: "relative/root", event: makeEvent() });

		expect(result.written).toBe(false);
	});
});
