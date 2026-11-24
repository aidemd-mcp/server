import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

const { mockFind } = vi.hoisted(() => ({ mockFind: vi.fn() }));

vi.mock("@/observer/findRunningObserver/index.js", () => ({ default: mockFind }));

import awaitObserver from "./index.js";

const observer = { address: "http://127.0.0.1:23456", token: "abc", pid: 7, version: "0.15.0" };

function makeChild(): ChildProcess {
	return new EventEmitter() as unknown as ChildProcess;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("awaitObserver", () => {
	it("resolves answered with the finder's observer when found on the third poll", async () => {
		const child = makeChild();
		mockFind.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(observer);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(300);

		await expect(reply).resolves.toEqual({ outcome: "answered", observer });
		expect(mockFind).toHaveBeenCalledTimes(3);
		expect(mockFind).toHaveBeenCalledWith();
		expect(child.listenerCount("exit")).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("resolves not-started naming the port and exit code when the child exits non-zero", async () => {
		const child = makeChild();
		mockFind.mockResolvedValue(null);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(150);
		child.emit("exit", 1);
		await vi.advanceTimersByTimeAsync(10000);

		await expect(reply).resolves.toEqual({
			outcome: "not-started",
			reason: "port 23456 is busy or the observer could not start (exit code 1)",
		});
		expect(child.listenerCount("exit")).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("resolves answered when the child exits busy and another observer comes up a moment later", async () => {
		const child = makeChild();
		mockFind.mockResolvedValue(null);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(150);
		child.emit("exit", 1);
		await vi.advanceTimersByTimeAsync(500);
		mockFind.mockResolvedValue(observer);
		await vi.advanceTimersByTimeAsync(200);

		await expect(reply).resolves.toEqual({ outcome: "answered", observer });
		expect(child.listenerCount("exit")).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("resolves not-started naming the cause when the child cannot be spawned", async () => {
		const child = makeChild();
		mockFind.mockResolvedValue(null);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(150);
		child.emit("error", Object.assign(new Error("spawn x ENOENT"), { code: "ENOENT" }));

		const settled = await reply;
		expect(settled.outcome).toBe("not-started");
		expect(settled).toMatchObject({ reason: expect.stringContaining("could not be started") });
		expect(settled).toMatchObject({ reason: expect.stringContaining("ENOENT") });
		expect(child.listenerCount("error")).toBe(0);
		expect(child.listenerCount("exit")).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("resolves answered after a last lookup when the child exits 0 and an observer is serving", async () => {
		const child = makeChild();
		mockFind.mockResolvedValueOnce(null).mockResolvedValue(observer);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(0);
		child.emit("exit", 0);

		await expect(reply).resolves.toEqual({ outcome: "answered", observer });
		expect(vi.getTimerCount()).toBe(0);
	});

	it("resolves not-started when the child exits 0 and no observer answers", async () => {
		const child = makeChild();
		mockFind.mockResolvedValue(null);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(150);
		child.emit("exit", 0);
		await vi.advanceTimersByTimeAsync(0);

		const settled = await reply;
		expect(settled.outcome).toBe("not-started");
		expect(JSON.stringify(settled)).not.toContain("busy");
	});

	it("settles once when an error is followed by an exit", async () => {
		const child = makeChild();
		mockFind.mockResolvedValue(null);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(150);
		child.emit("error", Object.assign(new Error("spawn x EACCES"), { code: "EACCES" }));
		child.emit("exit", 1);

		await expect(reply).resolves.toMatchObject({
			outcome: "not-started",
			reason: expect.stringContaining("EACCES"),
		});
	});

	it("resolves not-started with the timeout reason after 10 s of silence", async () => {
		const child = makeChild();
		mockFind.mockResolvedValue(null);

		const reply = awaitObserver({ port: 23456, child });
		await vi.advanceTimersByTimeAsync(10000);

		await expect(reply).resolves.toEqual({
			outcome: "not-started",
			reason: "the observer did not answer on port 23456 within 10 s",
		});
		expect(child.listenerCount("exit")).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});
});
