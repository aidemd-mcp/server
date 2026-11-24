import { describe, expect, it } from "vitest";
import deadPid from "./index.js";

function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
		throw error;
	}
}

describe("deadPid", () => {
	it("returns a positive integer pid", async () => {
		const pid = await deadPid();

		expect(Number.isInteger(pid)).toBe(true);
		expect(pid).toBeGreaterThan(0);
	});

	it("returns the pid of a process that has already exited", async () => {
		const pid = await deadPid();

		expect(isRunning(pid)).toBe(false);
	});

	it("is not the pid of the running test process", async () => {
		const pid = await deadPid();

		expect(pid).not.toBe(process.pid);
	});
});
