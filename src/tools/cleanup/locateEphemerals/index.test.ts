import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import locateEphemerals from "./index.js";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "locate-ephemerals-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("locateEphemerals", () => {
	it("returns all three in removal order", async () => {
		for (const name of ["plan.aide", "todo.aide", "brief.aide"]) await writeFile(join(dir, name), "x");
		expect(await locateEphemerals(dir)).toEqual({
			kind: "ok",
			present: ["brief.aide", "todo.aide", "plan.aide"],
		});
	});

	it("returns only plan.aide when it is the only one present", async () => {
		await writeFile(join(dir, "plan.aide"), "x");
		expect(await locateEphemerals(dir)).toEqual({ kind: "ok", present: ["plan.aide"] });
	});

	it("returns an empty list when none are present", async () => {
		expect(await locateEphemerals(dir)).toEqual({ kind: "ok", present: [] });
	});

	it("refuses a directory named todo.aide as not-a-file", async () => {
		await mkdir(join(dir, "todo.aide"));
		await writeFile(join(dir, "plan.aide"), "x");
		expect(await locateEphemerals(dir)).toEqual({
			kind: "refused",
			refusal: { kind: "not-a-file", file: "todo.aide" },
		});
	});

	it("never reports non-ephemeral files", async () => {
		for (const name of [".aide", "intent.aide", "research.aide", "session.aide", "index.ts"]) {
			await writeFile(join(dir, name), "x");
		}
		await writeFile(join(dir, "plan.aide"), "x");
		expect(await locateEphemerals(dir)).toEqual({ kind: "ok", present: ["plan.aide"] });
	});
});
