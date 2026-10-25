import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import resolveTarget from "./index.js";

let sandbox: string;
let root: string;
let outside: string;

beforeEach(async () => {
	sandbox = await realpath(await mkdtemp(join(tmpdir(), "resolve-target-")));
	root = join(sandbox, "root");
	outside = join(sandbox, "outside");
	await mkdir(join(root, "mod", "nested"), { recursive: true });
	await mkdir(outside);
	await writeFile(join(root, "mod", "plan.aide"), "x\n");
	await writeFile(join(outside, "other.aide"), "x\n");
});

afterEach(async () => {
	await rm(sandbox, { recursive: true, force: true });
});

describe("resolveTarget", () => {
	it("resolves a relative path inside the root with a POSIX rel", async () => {
		expect(await resolveTarget({ root, path: "mod/plan.aide" })).toEqual({
			kind: "ok",
			abs: join(root, "mod", "plan.aide"),
			rel: "mod/plan.aide",
		});
	});

	it("accepts an absolute path inside the root", async () => {
		expect(await resolveTarget({ root, path: join(root, "mod", "plan.aide") })).toEqual({
			kind: "ok",
			abs: join(root, "mod", "plan.aide"),
			rel: "mod/plan.aide",
		});
	});

	it.each([
		["a parent-relative path", () => "../outside/other.aide"],
		["an absolute path outside the root", () => join(outside, "other.aide")],
	])("refuses %s as outside-root", async (_name, getPath) => {
		expect(await resolveTarget({ root, path: getPath() })).toEqual({
			kind: "refused",
			refusal: { kind: "outside-root" },
		});
	});

	it("refuses a link inside the root that points outside as outside-root", async () => {
		try {
			await symlink(outside, join(root, "escape"), "junction");
		} catch {
			return; // Platform cannot create the link.
		}
		expect(await resolveTarget({ root, path: "escape/other.aide" })).toEqual({
			kind: "refused",
			refusal: { kind: "outside-root" },
		});
	});

	it("refuses a missing file as missing", async () => {
		expect(await resolveTarget({ root, path: "mod/nope.aide" })).toEqual({
			kind: "refused",
			refusal: { kind: "missing" },
		});
	});

	it("refuses a directory as not-a-file", async () => {
		expect(await resolveTarget({ root, path: "mod/nested" })).toEqual({
			kind: "refused",
			refusal: { kind: "not-a-file" },
		});
	});
});
