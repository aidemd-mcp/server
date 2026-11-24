import { afterEach, describe, it, expect, vi } from "vitest";
import { spawn } from "node:child_process";
import isProcessRunning from "./index.js";

describe("isProcessRunning", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("is true for the current process", () => {
		expect(isProcessRunning(process.pid)).toBe(true);
	});

	it("is false for the pid of a child that has exited", async () => {
		const child = spawn(process.execPath, ["-e", ""]);
		const pid = child.pid as number;
		await new Promise((resolve) => child.once("exit", resolve));
		expect(isProcessRunning(pid)).toBe(false);
	});

	it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])(
		"is false for %s without probing any process",
		(pid) => {
			const kill = vi.spyOn(process, "kill");
			expect(isProcessRunning(pid)).toBe(false);
			expect(kill).not.toHaveBeenCalled();
		},
	);

	it("is true when the process exists but belongs to another user (EPERM)", () => {
		vi.spyOn(process, "kill").mockImplementation(() => {
			throw Object.assign(new Error("denied"), { code: "EPERM" });
		});
		expect(isProcessRunning(4242)).toBe(true);
	});

	it("is false when no such process exists (ESRCH)", () => {
		vi.spyOn(process, "kill").mockImplementation(() => {
			throw Object.assign(new Error("gone"), { code: "ESRCH" });
		});
		expect(isProcessRunning(4242)).toBe(false);
	});
});
