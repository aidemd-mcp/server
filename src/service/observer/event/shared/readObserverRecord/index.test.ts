import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/util/isProcessRunning/index.js", () => ({ default: vi.fn() }));

import isProcessRunning from "@/util/isProcessRunning/index.js";
import readObserverRecord from "./index.js";

const mockIsProcessRunning = vi.mocked(isProcessRunning);

let folder: string;
let observerFile: string;

beforeEach(async () => {
	vi.clearAllMocks();
	mockIsProcessRunning.mockReturnValue(true);
	folder = await mkdtemp(path.join(tmpdir(), "aide-observer-record-"));
	observerFile = path.join(folder, "observer.json");
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("readObserverRecord", () => {
	it("returns null when the file is missing", async () => {
		expect(await readObserverRecord({ observerFile })).toBeNull();
	});

	it("returns null for invalid JSON", async () => {
		await writeFile(observerFile, "{ not json");

		expect(await readObserverRecord({ observerFile })).toBeNull();
	});

	it("returns null for JSON that is off schema", async () => {
		await writeFile(observerFile, JSON.stringify({ address: "http://localhost:1", token: "t", pid: 1 }));

		expect(await readObserverRecord({ observerFile })).toBeNull();
	});

	it("returns null for a record without a version", async () => {
		await writeFile(observerFile, JSON.stringify({ address: "http://127.0.0.1:4317", token: "abc", pid: 123 }));

		expect(await readObserverRecord({ observerFile })).toBeNull();
	});

	it("returns null when the pid is not running", async () => {
		mockIsProcessRunning.mockReturnValue(false);
		await writeFile(observerFile, JSON.stringify({ address: "http://127.0.0.1:4317", token: "abc", pid: 123, version: "0.15.0" }));

		expect(await readObserverRecord({ observerFile })).toBeNull();
		expect(mockIsProcessRunning).toHaveBeenCalledWith(123);
	});

	it("returns the record when it is valid and its pid is running", async () => {
		const record = { address: "http://127.0.0.1:4317", token: "abc", pid: 123, version: "0.15.0" };
		await writeFile(observerFile, JSON.stringify(record));

		expect(await readObserverRecord({ observerFile })).toEqual(record);
	});
});
