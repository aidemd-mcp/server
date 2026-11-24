import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/service/observer/event/read/index.js", () => ({ default: vi.fn() }));

import read from "@/service/observer/event/read/index.js";
import replaySessions from "./index.js";

const mockRead = read as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("replaySessions", () => {
	it("returns what the event read returns for every project", async () => {
		const projects = [{ projectKey: "p-aaaaaa", projectRoot: null, sessions: [] }];
		mockRead.mockResolvedValue(projects);
		expect(await replaySessions()).toBe(projects);
		expect(mockRead).toHaveBeenCalledWith();
	});

	it("degrades to an empty history and writes one stderr line when the read throws", async () => {
		mockRead.mockRejectedValue(new Error("broken folder"));
		const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		expect(await replaySessions()).toEqual([]);
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith("observer: replay failed: broken folder\n");
	});
});
