import { describe, expect, it } from "vitest";
import type { Status, WaitingFile } from "@/types/index.js";
import buildWaitBanner from "./index.js";

const NOW = new Date("2026-01-01T10:00:00.000Z");

function gate(overrides: Partial<WaitingFile>): WaitingFile {
	return { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 3, since: "2026-01-01T09:58:00.000Z", ...overrides };
}

const statusOf = (waiting: WaitingFile[]) => ({ waiting }) as Status;

describe("buildWaitBanner", () => {
	it("words the followed session's gate: base name, module, the span waited and the file's path", () => {
		expect(buildWaitBanner({ status: statusOf([gate({})]), focus: "s1", name: "app", now: NOW })).toEqual({
			file: "plan.aide",
			module: "src/a",
			since: "2m",
			path: "src/a/plan.aide",
		});
	});

	it("prefers the followed session's gate, else the first open one", () => {
		const other = gate({ sessionId: "s2", file: "src/b/todo.aide", folder: "src/b", kind: "todo" });
		const status = statusOf([other, gate({})]);
		expect(buildWaitBanner({ status, focus: "s1", name: "app", now: NOW })?.file).toBe("plan.aide");
		expect(buildWaitBanner({ status, focus: "s9", name: "app", now: NOW })?.file).toBe("todo.aide");
	});

	it("reads the root module as the project's name", () => {
		const status = statusOf([gate({ file: ".aide/intent.aide", folder: ".", kind: "intent" })]);
		expect(buildWaitBanner({ status, focus: "s1", name: "app", now: NOW })?.module).toBe("app");
	});

	it("is null with no gate or no status", () => {
		expect(buildWaitBanner({ status: statusOf([]), focus: "s1", name: "app", now: NOW })).toBeNull();
		expect(buildWaitBanner({ status: null, focus: "s1", name: "app", now: NOW })).toBeNull();
	});
});
