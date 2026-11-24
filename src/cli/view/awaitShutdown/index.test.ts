import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import awaitShutdown from "./index.js";

describe("awaitShutdown", () => {
	let startingCounts: Record<string, number>;
	let stderrWrite: ReturnType<typeof vi.fn>;
	let originalWrite: typeof process.stderr.write;

	beforeEach(() => {
		startingCounts = { SIGINT: process.listenerCount("SIGINT"), SIGTERM: process.listenerCount("SIGTERM") };
		originalWrite = process.stderr.write;
		stderrWrite = vi.fn(() => true);
		process.stderr.write = stderrWrite as unknown as typeof process.stderr.write;
	});

	afterEach(() => {
		process.stderr.write = originalWrite;
	});

	const never = () => new Promise<void>(() => undefined);

	it("resolves without stopping when stopped settles, removing both listeners", async () => {
		const stop = vi.fn().mockResolvedValue(undefined);
		let markStopped: () => void = () => undefined;
		const stopped = new Promise<void>((done) => {
			markStopped = done;
		});
		const waiting = awaitShutdown({ stop, stopped });

		markStopped();
		await waiting;

		expect(stop).not.toHaveBeenCalled();
		expect(process.listenerCount("SIGINT")).toBe(startingCounts.SIGINT);
		expect(process.listenerCount("SIGTERM")).toBe(startingCounts.SIGTERM);
	});

	it.each(["SIGINT", "SIGTERM"] as const)("stops once on %s and removes both listeners", async (signal) => {
		const stop = vi.fn().mockResolvedValue(undefined);
		const waiting = awaitShutdown({ stop, stopped: never() });
		expect(process.listenerCount(signal)).toBe(startingCounts[signal]! + 1);

		process.emit(signal);
		await waiting;

		expect(stop).toHaveBeenCalledTimes(1);
		expect(process.listenerCount("SIGINT")).toBe(startingCounts.SIGINT);
		expect(process.listenerCount("SIGTERM")).toBe(startingCounts.SIGTERM);
	});

	it("does not call stop again for a second signal", async () => {
		const stop = vi.fn().mockResolvedValue(undefined);
		const waiting = awaitShutdown({ stop, stopped: never() });
		process.emit("SIGINT");
		process.emit("SIGTERM");
		await waiting;
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("still resolves when stop rejects, reporting the error", async () => {
		const stop = vi.fn().mockRejectedValue(new Error("boom"));
		const waiting = awaitShutdown({ stop, stopped: never() });
		process.emit("SIGINT");
		await expect(waiting).resolves.toBeUndefined();
		expect(stderrWrite).toHaveBeenCalledWith("Error: boom\n");
	});
});
