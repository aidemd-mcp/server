import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const failure = vi.hoisted(() => ({ file: null as string | null, attempted: [] as string[] }));

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		unlink: async (path: Parameters<typeof actual.unlink>[0]) => {
			failure.attempted.push(basename(String(path)));
			if (failure.file !== null && basename(String(path)) === failure.file) {
				throw new Error(`EBUSY: resource busy or locked, unlink '${String(path)}'`);
			}
			return actual.unlink(path);
		},
	};
});

import removeEphemerals from "./index.js";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "remove-ephemerals-"));
	failure.file = null;
	failure.attempted = [];
});

afterEach(async () => {
	failure.file = null;
	await rm(dir, { recursive: true, force: true });
});

describe("removeEphemerals", () => {
	it("removes all three and reports them in order", async () => {
		for (const name of ["brief.aide", "todo.aide", "plan.aide"]) await writeFile(join(dir, name), "x");
		const result = await removeEphemerals(dir, ["brief.aide", "todo.aide", "plan.aide"]);
		expect(result).toEqual({ kind: "removed", files: ["brief.aide", "todo.aide", "plan.aide"] });
		for (const name of ["brief.aide", "todo.aide", "plan.aide"]) expect(existsSync(join(dir, name))).toBe(false);
	});

	it("removes only plan.aide when it is the only one present", async () => {
		await writeFile(join(dir, "plan.aide"), "x");
		await writeFile(join(dir, "index.ts"), "keep");
		const result = await removeEphemerals(dir, ["plan.aide"]);
		expect(result).toEqual({ kind: "removed", files: ["plan.aide"] });
		expect(existsSync(join(dir, "plan.aide"))).toBe(false);
		expect(existsSync(join(dir, "index.ts"))).toBe(true);
	});

	it("reports an incomplete removal when an unlink fails partway", async () => {
		for (const name of ["brief.aide", "todo.aide", "plan.aide"]) await writeFile(join(dir, name), "x");
		failure.file = "todo.aide";
		const result = await removeEphemerals(dir, ["brief.aide", "todo.aide", "plan.aide"]);
		expect(result).toEqual({
			kind: "incomplete",
			removed: ["brief.aide"],
			remaining: ["todo.aide", "plan.aide"],
			error: expect.stringContaining("EBUSY"),
		});
		expect(existsSync(join(dir, "brief.aide"))).toBe(false);
		expect(existsSync(join(dir, "plan.aide"))).toBe(true);
		expect(failure.attempted).not.toContain("plan.aide");
	});
});
