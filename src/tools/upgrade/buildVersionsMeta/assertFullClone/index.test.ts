import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import assertFullClone from "./index.js";

// execFile has complex overloads — cast to avoid TS inferring the overload set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecFile = vi.mocked(execFile as any);

const REPO_ROOT = "/repo";

/** Makes the mocked git succeed with the given stdout. The options object makes the callback the 4th argument. */
function gitPrints(stdout: string): void {
	mockExecFile.mockImplementation((...args: unknown[]) => {
		const cb = args[args.length - 1] as (err: Error | null, result?: { stdout: string; stderr: string }) => void;
		cb(null, { stdout, stderr: "" });
	});
}

/** Makes the mocked git fail to run with the given error. */
function gitFails(error: Error): void {
	mockExecFile.mockImplementation((...args: unknown[]) => {
		const cb = args[args.length - 1] as (err: Error) => void;
		cb(error);
	});
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("assertFullClone", () => {
	it("resolves with no value when the clone has full history", async () => {
		gitPrints("false\n");
		await expect(assertFullClone(REPO_ROOT)).resolves.toBeUndefined();
	});

	it("rejects when the clone is shallow", async () => {
		gitPrints("true\n");
		const rejection = assertFullClone(REPO_ROOT);
		await expect(rejection).rejects.toThrow("shallow git clone detected");
		await expect(assertFullClone(REPO_ROOT)).rejects.toThrow("fetch-depth: 0");
	});

	it("rejects when old git echoes the flag instead of answering", async () => {
		gitPrints("--is-shallow-repository\n");
		await expect(assertFullClone(REPO_ROOT)).rejects.toThrow("could not determine whether the clone is shallow");
	});

	it("propagates the exec rejection unchanged", async () => {
		const error = new Error("spawn git ENOENT");
		gitFails(error);
		await expect(assertFullClone(REPO_ROOT)).rejects.toBe(error);
	});

	it("runs git rev-parse --is-shallow-repository in the given repo root", async () => {
		gitPrints("false\n");
		await assertFullClone(REPO_ROOT);
		expect(mockExecFile).toHaveBeenCalledWith(
			"git",
			["rev-parse", "--is-shallow-repository"],
			expect.objectContaining({ cwd: REPO_ROOT }),
			expect.any(Function),
		);
	});
});
