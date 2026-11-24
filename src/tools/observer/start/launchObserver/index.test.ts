import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));

import launchObserver from "./index.js";

function makeChild() {
	return Object.assign(new EventEmitter(), { unref: vi.fn() });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("launchObserver", () => {
	it("spawns the entry script's view command detached with the given port and unrefs the child", () => {
		const child = makeChild();
		mockSpawn.mockReturnValue(child);

		const result = launchObserver({ root: "/project", port: 23456, entryScript: "/pkg/dist/index.js" });

		expect(mockSpawn).toHaveBeenCalledTimes(1);
		expect(mockSpawn).toHaveBeenCalledWith(
			process.execPath,
			["/pkg/dist/index.js", "view", "--port", "23456"],
			{ cwd: "/project", detached: true, stdio: "ignore", windowsHide: true },
		);
		expect(child.unref).toHaveBeenCalledTimes(1);
		expect(result).toBe(child);
	});

	it("never passes --brain", () => {
		mockSpawn.mockReturnValue(makeChild());

		launchObserver({ root: "/project", port: 23456, entryScript: "/pkg/dist/index.js" });

		expect(mockSpawn.mock.calls[0][1]).not.toContain("--brain");
	});

	it("keeps one error listener on the child so a spawn failure never goes unhandled", () => {
		const child = makeChild();
		mockSpawn.mockReturnValue(child);

		launchObserver({ root: "/project", port: 23456, entryScript: "/pkg/dist/index.js" });

		expect(child.listenerCount("error")).toBe(1);
		expect(() =>
			child.emit("error", Object.assign(new Error("spawn x ENOENT"), { code: "ENOENT" })),
		).not.toThrow();
	});
});
