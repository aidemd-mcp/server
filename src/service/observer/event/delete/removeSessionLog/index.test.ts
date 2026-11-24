import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/util/isProcessRunning/index.js", () => ({
	default: vi.fn(),
}));

import isProcessRunning from "@/util/isProcessRunning/index.js";
import removeSessionLog from "./index.js";

const mockIsProcessRunning = isProcessRunning as ReturnType<typeof vi.fn>;

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const SESSION_A = "20261122T090000000Z-aaaaaa";
const SESSION_B = "20261122T100000000Z-bbbbbb";

let folder: string;

function makeLine(sessionId: string, ageMs: number): string {
	return (
		JSON.stringify({
			v: 1,
			ts: new Date(NOW - ageMs).toISOString(),
			sessionId,
			seq: 1,
			pid: 4242,
			kind: "release",
			version: "1.0.0",
		}) + "\n"
	);
}

async function writeSession(sessionId: string, ageMs: number): Promise<string> {
	const file = path.join(folder, `${sessionId}.jsonl`);
	await writeFile(file, makeLine(sessionId, ageMs), "utf-8");
	return file;
}

beforeEach(async () => {
	vi.clearAllMocks();
	mockIsProcessRunning.mockReturnValue(false);
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	folder = await mkdtemp(path.join(tmpdir(), "aide-remove-session-log-"));
});

afterEach(async () => {
	vi.useRealTimers();
	await rm(folder, { recursive: true, force: true });
});

describe("removeSessionLog", () => {
	it("reports not-found when the file does not exist", async () => {
		const other = await writeSession(SESSION_B, 2 * HOUR);

		const result = await removeSessionLog({ path: path.join(folder, `${SESSION_A}.jsonl`), sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "not-found" });
		expect(existsSync(other)).toBe(true);
	});

	it("refuses an unreadable log and leaves it in place", async () => {
		const other = await writeSession(SESSION_B, 2 * HOUR);
		// A directory in the file's place: reading it fails with EISDIR on every OS.
		const target = path.join(folder, `${SESSION_A}.jsonl`);
		await mkdir(target);

		const result = await removeSessionLog({ path: target, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "unreadable" });
		expect(existsSync(target)).toBe(true);
		expect(existsSync(other)).toBe(true);
	});

	it("refuses a live session (recent event) and leaves its file untouched", async () => {
		const target = await writeSession(SESSION_A, 60 * 1000);
		const before = await readFile(target, "utf-8");

		const result = await removeSessionLog({ path: target, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(await readFile(target, "utf-8")).toBe(before);
	});

	it("refuses a session that is live by its pid alone", async () => {
		mockIsProcessRunning.mockReturnValue(true);
		const target = await writeSession(SESSION_A, 2 * HOUR);

		const result = await removeSessionLog({ path: target, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "live" });
		expect(existsSync(target)).toBe(true);
	});

	it("removes a past session by unlinking exactly that one file", async () => {
		const target = await writeSession(SESSION_A, 2 * HOUR);
		const other = await writeSession(SESSION_B, 2 * HOUR);

		const result = await removeSessionLog({ path: target, sessionId: SESSION_A });

		expect(result).toEqual({ outcome: "deleted" });
		expect(existsSync(target)).toBe(false);
		expect(await readdir(folder)).toEqual([path.basename(other)]);
	});
});
