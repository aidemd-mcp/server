import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import resolveModule from "./index.js";

let sandbox: string;
let root: string;
let outside: string;

beforeEach(async () => {
	sandbox = await realpath(await mkdtemp(join(tmpdir(), "resolve-module-")));
	root = join(sandbox, "root");
	outside = join(sandbox, "outside");
	await mkdir(join(root, "mod", "nested"), { recursive: true });
	await mkdir(outside);
	await writeFile(join(root, "mod", "plan.aide"), "- [x] done\n");
});

afterEach(async () => {
	await rm(sandbox, { recursive: true, force: true });
});

describe("resolveModule", () => {
	it('resolves "." to the root with module "."', async () => {
		expect(await resolveModule(root, ".")).toEqual({ kind: "ok", dir: root, module: "." });
	});

	it("resolves a nested relative path", async () => {
		expect(await resolveModule(root, "mod/nested")).toEqual({
			kind: "ok",
			dir: join(root, "mod", "nested"),
			module: "mod/nested",
		});
	});

	it("accepts an absolute path inside the root", async () => {
		expect(await resolveModule(root, join(root, "mod"))).toEqual({
			kind: "ok",
			dir: join(root, "mod"),
			module: "mod",
		});
	});

	it.each([
		["a parent-relative path", () => "../outside"],
		["a path that climbs out after descending", () => "sub/../../outside"],
		["an absolute path outside the root", () => outside],
	])("refuses %s as outside-root", async (_name, getPath) => {
		const path = getPath();
		expect(await resolveModule(root, path)).toEqual({
			kind: "refused",
			module: path,
			refusal: { kind: "outside-root" },
		});
	});

	it("refuses a file path as not-a-directory", async () => {
		expect(await resolveModule(root, "mod/plan.aide")).toEqual({
			kind: "refused",
			module: "mod/plan.aide",
			refusal: { kind: "not-a-directory" },
		});
	});

	it("refuses a nonexistent path as missing", async () => {
		expect(await resolveModule(root, "nope")).toEqual({
			kind: "refused",
			module: "nope",
			refusal: { kind: "missing" },
		});
	});

	it("refuses a junction or symlink that points outside the root", async () => {
		await symlink(outside, join(root, "escape"), "junction");
		expect(await resolveModule(root, "escape")).toEqual({
			kind: "refused",
			module: "escape",
			refusal: { kind: "outside-root" },
		});
	});
});
