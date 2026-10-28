import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import installGlobalPackage from "./index.js";

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

function fakeChild(): EventEmitter {
	const child = new EventEmitter();
	mockSpawn.mockReturnValue(child);
	return child;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("installGlobalPackage", () => {
	it("spawns the command through a shell with inherited stdio", async () => {
		const child = fakeChild();
		const pending = installGlobalPackage("npm i -g x");
		child.emit("exit", 0);
		await pending;
		expect(mockSpawn).toHaveBeenCalledWith("npm i -g x", { shell: true, stdio: "inherit" });
	});

	it("resolves true on exit code 0", async () => {
		const child = fakeChild();
		const pending = installGlobalPackage("npm i -g x");
		child.emit("exit", 0);
		expect(await pending).toBe(true);
	});

	it("resolves false on a non-zero exit", async () => {
		const child = fakeChild();
		const pending = installGlobalPackage("npm i -g x");
		child.emit("exit", 1);
		expect(await pending).toBe(false);
	});

	it("resolves false on a spawn error without throwing", async () => {
		const child = fakeChild();
		const pending = installGlobalPackage("npm i -g x");
		child.emit("error", new Error("ENOENT"));
		expect(await pending).toBe(false);
	});
});
