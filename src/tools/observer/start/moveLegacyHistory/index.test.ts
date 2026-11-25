import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMove } = vi.hoisted(() => ({ mockMove: vi.fn() }));
vi.mock("@/util/runtimePaths/moveLegacyRoot/index.js", () => ({ default: mockMove }));

import moveLegacyHistory from "./index.js";

const write = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
});

describe("moveLegacyHistory", () => {
	it("writes nothing when there is nothing to move", async () => {
		mockMove.mockResolvedValue({ outcome: "none" });
		await moveLegacyHistory({ write });
		expect(write).not.toHaveBeenCalled();
	});

	it("writes nothing for a clean move", async () => {
		mockMove.mockResolvedValue({ outcome: "moved", legacyRoot: "C:\old", moved: 3, superseded: 1, left: [] });
		await moveLegacyHistory({ write });
		expect(write).not.toHaveBeenCalled();
	});

	it("writes one line naming every file left in place and its reason", async () => {
		mockMove.mockResolvedValue({
			outcome: "moved",
			legacyRoot: "C:\old",
			moved: 2,
			superseded: 0,
			left: [
				{ path: "C:\old\p\events\a.jsonl", reason: "diverged" },
				{ path: "C:\old\p\presence\b.json", reason: "error", detail: "EPERM" },
			],
		});
		await moveLegacyHistory({ write });
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(
			"aide: moved 2 runtime file(s) from C:\old to the per-user folder; 2 left in place: C:\old\p\events\a.jsonl (diverged), C:\old\p\presence\b.json (error: EPERM)\n",
		);
	});

	it("writes the could-not-move line and resolves when the move rejects", async () => {
		mockMove.mockRejectedValue(new Error("cannot list"));
		await expect(moveLegacyHistory({ write })).resolves.toBeUndefined();
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(
			"aide: could not move runtime files from the old per-user folder: cannot list\n",
		);
	});

	it("defaults to a stderr line writer", async () => {
		const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		mockMove.mockRejectedValue(new Error("boom"));
		await moveLegacyHistory();
		expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/^aide: could not move .*boom\n$/));
		stderr.mockRestore();
	});
});
