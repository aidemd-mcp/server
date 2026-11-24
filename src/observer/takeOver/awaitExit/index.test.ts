import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/util/isProcessRunning/index.js", () => ({ default: vi.fn() }));

import isProcessRunning from "@/util/isProcessRunning/index.js";
import awaitExit from "./index.js";

const mockRunning = vi.mocked(isProcessRunning);

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("awaitExit", () => {
	it("answers true at once when the pid is already gone", async () => {
		mockRunning.mockReturnValue(false);

		await expect(awaitExit({ pid: 42, timeoutMs: 3000, intervalMs: 100 })).resolves.toBe(true);
		expect(mockRunning).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("answers true when the pid goes away between polls", async () => {
		mockRunning.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
		const pending = awaitExit({ pid: 42, timeoutMs: 3000, intervalMs: 100 });

		await vi.advanceTimersByTimeAsync(200);

		await expect(pending).resolves.toBe(true);
		expect(mockRunning).toHaveBeenCalledWith(42);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("answers false once the timeout passes with the pid still running, and clears its timer", async () => {
		mockRunning.mockReturnValue(true);
		const pending = awaitExit({ pid: 42, timeoutMs: 3000, intervalMs: 100 });

		await vi.advanceTimersByTimeAsync(3100);

		await expect(pending).resolves.toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});
