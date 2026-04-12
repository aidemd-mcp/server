import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/tools/init/initContent/index.js");

// Mock child_process before importing the module under test.
vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

import { listMethodologyDocs } from "@/tools/init/initContent/index.js";
import { execFile } from "node:child_process";
import buildVersionsMeta from "./index.js";

/** Helper to make the execFile mock resolve with given stdout. */
function mockGitLog(stdoutByCall: (string | Error)[]) {
	const mock = execFile as unknown as ReturnType<typeof vi.fn>;
	for (const entry of stdoutByCall) {
		if (entry instanceof Error) {
			mock.mockImplementationOnce(
				(_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
					cb(entry);
				},
			);
		} else {
			mock.mockImplementationOnce(
				(_cmd: string, _args: string[], _opts: unknown, cb: (err: null, result: { stdout: string }) => void) => {
					cb(null, { stdout: entry });
				},
			);
		}
	}
}

beforeEach(() => {
	vi.resetAllMocks();

	vi.mocked(listMethodologyDocs).mockReturnValue([
		{ canonical: "aide-spec" as const, hostFilename: "aide-spec.md" },
		{ canonical: "index" as const, hostFilename: "index.md" },
	]);
});

describe("buildVersionsMeta", () => {
	it("returns correct metadata when git log returns two commits", async () => {
		mockGitLog([
			"abc1234567890abcdef1234567890abcdef123456 2026-04-11T14:30:00+00:00\ndef5678901234567890abcdef1234567890abcdef 2026-03-15T09:00:00+00:00\n",
			"b2c3d4e567890abcdef1234567890abcdef123456 2026-03-10T08:00:00+00:00\n",
		]);

		const result = await buildVersionsMeta();

		expect(result["aide-spec"]).toEqual({
			publishedAt: "2026-04-11T14:30:00+00:00",
			sourceCommit: "abc1234",
			previousCommit: "def5678",
		});

		expect(result["index"]).toEqual({
			publishedAt: "2026-03-10T08:00:00+00:00",
			sourceCommit: "b2c3d4e",
		});
	});

	it("omits previousCommit when git log returns only one commit", async () => {
		mockGitLog([
			"abc1234567890abcdef1234567890abcdef123456 2026-04-11T14:30:00+00:00\n",
			"b2c3d4e567890abcdef1234567890abcdef123456 2026-03-10T08:00:00+00:00\n",
		]);

		const result = await buildVersionsMeta();

		expect(result["aide-spec"].previousCommit).toBeUndefined();
		expect(result["index"].previousCommit).toBeUndefined();
	});

	it("omits slug when git log returns empty output", async () => {
		mockGitLog([
			"abc1234567890abcdef1234567890abcdef123456 2026-04-11T14:30:00+00:00\n",
			"", // index.md has no commits
		]);

		const result = await buildVersionsMeta();

		expect(result["aide-spec"]).toBeDefined();
		expect(result["index"]).toBeUndefined();
	});

	it("returns empty object when git command fails", async () => {
		mockGitLog([
			new Error("git not found"),
			new Error("git not found"),
		]);

		const result = await buildVersionsMeta();

		expect(result).toEqual({});
	});
});
