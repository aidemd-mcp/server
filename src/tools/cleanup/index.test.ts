import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import cleanup, { CleanupInput } from "./index.js";

const PLAN_CHECKED = "# Plan\n\n- [x] Step one\n- [x] Step two\n";
const PLAN_UNCHECKED = "# Plan\n\n- [x] Step one\n- [ ] Step two still open\n";
const PLAN_EMPTY = "# Plan\n\nNo checkboxes anywhere in here.\n";
const TODO_CHECKED = "# Todo\n\n- [x] Fixed it\n";
const TODO_UNCHECKED = "# Todo\n\n- [x] Fixed it\n- [ ] Fix the other thing\n";
const BRIEF = "# Brief\n\n- [ ] Not a checkbox contract\n";

type ModuleContents = { plan?: string; todo?: string; brief?: string };

/** Writes the given ephemerals into `dir`, creating it first. */
async function makeModule(dir: string, { plan, todo, brief }: ModuleContents) {
	await mkdir(dir, { recursive: true });
	if (plan !== undefined) await writeFile(join(dir, "plan.aide"), plan);
	if (todo !== undefined) await writeFile(join(dir, "todo.aide"), todo);
	if (brief !== undefined) await writeFile(join(dir, "brief.aide"), brief);
}

/** Maps every file under `dir` (relative POSIX path) to its content, so two snapshots can be compared byte for byte. */
async function snapshot(dir: string, prefix = ""): Promise<Record<string, string>> {
	const files: Record<string, string> = {};
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const relativePath = `${prefix}${entry.name}`;
		if (entry.isSymbolicLink()) files[relativePath] = "<link>";
		else if (entry.isDirectory()) Object.assign(files, await snapshot(join(dir, entry.name), `${relativePath}/`));
		else files[relativePath] = await readFile(join(dir, entry.name), "utf-8");
	}
	return files;
}

const EPHEMERALS = ["plan.aide", "todo.aide", "brief.aide"];

let base: string;
let root: string;
let outside: string;

beforeEach(async () => {
	// Resolve the temp dir up front: on Windows it may be an 8.3 short name.
	base = await realpath(await mkdtemp(join(tmpdir(), "cleanup-")));
	root = join(base, "root");
	outside = join(base, "outside");
	await mkdir(root);
	await mkdir(outside);
});

afterEach(async () => {
	await rm(base, { recursive: true, force: true });
});

describe("cleanup input schema", () => {
	it("defaults dryRun and allowEmptyPlan to false", () => {
		expect(CleanupInput.parse({ path: "src/x" })).toEqual({ path: "src/x", dryRun: false, allowEmptyPlan: false });
	});

	it("rejects an empty path", () => {
		expect(CleanupInput.safeParse({ path: "" }).success).toBe(false);
	});
});

describe("cleanup scope", () => {
	it("removes only the three ephemerals of the named module", async () => {
		const mod = join(root, "parent", "mod");
		await makeModule(mod, { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF });
		for (const name of [".aide", "intent.aide", "research.aide", "index.ts", "session.aide"]) {
			await writeFile(join(mod, name), `content of ${name}`);
		}
		await makeModule(join(mod, "child"), { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF });
		await writeFile(join(root, "parent", "plan.aide"), PLAN_UNCHECKED);
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "parent/mod", dryRun: false, allowEmptyPlan: false });

		expect(result).toEqual({ kind: "removed", module: "parent/mod", files: ["brief.aide", "todo.aide", "plan.aide"] });
		const after = await snapshot(root);
		const removedKeys = EPHEMERALS.map((name) => `parent/mod/${name}`);
		const expected = Object.fromEntries(Object.entries(before).filter(([file]) => !removedKeys.includes(file)));
		expect(after).toEqual(expected);
		for (const name of EPHEMERALS) expect(existsSync(join(mod, name))).toBe(false);
		expect(existsSync(join(mod, "child", "plan.aide"))).toBe(true);
		expect(existsSync(join(root, "parent", "plan.aide"))).toBe(true);
	});

	it("cleans the root itself for path '.' and leaves .aide/session.aide alone", async () => {
		await makeModule(root, { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF });
		await mkdir(join(root, ".aide"));
		await writeFile(join(root, ".aide", "session.aide"), "session state");

		const result = await cleanup(root, { path: ".", dryRun: false, allowEmptyPlan: false });

		expect(result).toEqual({ kind: "removed", module: ".", files: ["brief.aide", "todo.aide", "plan.aide"] });
		expect(await snapshot(root)).toEqual({ ".aide/session.aide": "session state" });
	});
});

describe("cleanup path tricks", () => {
	beforeEach(async () => {
		await makeModule(base, { plan: PLAN_CHECKED });
		await makeModule(outside, { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF });
		await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF });
	});

	it.each([
		{ name: "a parent traversal", path: () => "..", refusal: { kind: "outside-root" } },
		{ name: "an absolute path outside the root", path: () => outside, refusal: { kind: "outside-root" } },
		{ name: "a file path", path: () => "mod/plan.aide", refusal: { kind: "not-a-directory" } },
	])("refuses $name and changes nothing", async ({ path, refusal }) => {
		const before = await snapshot(base);

		const result = await cleanup(root, { path: path(), dryRun: false, allowEmptyPlan: false });

		expect(result.kind).toBe("refused");
		expect(result).toMatchObject({ refusal });
		expect(await snapshot(base)).toEqual(before);
	});

	it("refuses a junction that escapes the root and changes nothing", async () => {
		await symlink(outside, join(root, "link"), "junction");
		const before = await snapshot(base);

		const result = await cleanup(root, { path: "link", dryRun: false, allowEmptyPlan: false });

		expect(result).toMatchObject({ kind: "refused", refusal: { kind: "outside-root" } });
		expect(await snapshot(base)).toEqual(before);
	});
});

describe("cleanup all-or-nothing", () => {
	it.each([
		{ name: "a checked plan plus an unchecked todo", contents: { plan: PLAN_CHECKED, todo: TODO_UNCHECKED, brief: BRIEF } },
		{ name: "an unchecked plan plus a checked todo", contents: { plan: PLAN_UNCHECKED, todo: TODO_CHECKED, brief: BRIEF } },
		{ name: "no plan but a todo and a brief", contents: { todo: TODO_CHECKED, brief: BRIEF } },
	])("leaves all files present for $name", async ({ contents }) => {
		const mod = join(root, "mod");
		await makeModule(mod, contents);
		const before = await snapshot(mod);

		const result = await cleanup(root, { path: "mod", dryRun: false, allowEmptyPlan: false });

		expect(result.kind).toBe("refused");
		expect(await snapshot(mod)).toEqual(before);
		for (const [name, key] of [["plan.aide", "plan"], ["todo.aide", "todo"], ["brief.aide", "brief"]] as const) {
			expect(existsSync(join(mod, name))).toBe(key in contents);
		}
	});

	it("never blocks on a missing todo", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: PLAN_CHECKED, brief: BRIEF });

		const result = await cleanup(root, { path: "mod", dryRun: false, allowEmptyPlan: false });

		expect(result).toEqual({ kind: "removed", module: "mod", files: ["brief.aide", "plan.aide"] });
		expect(existsSync(join(mod, "plan.aide"))).toBe(false);
		expect(existsSync(join(mod, "brief.aide"))).toBe(false);
	});
});

describe("cleanup named refusals", () => {
	it("lists every unchecked item with its file, line and exact text", async () => {
		await makeModule(join(root, "mod"), {
			plan: "# Plan\n\n- [x] Done\n- [ ] Wire the registry\n",
			todo: "# Todo\n\n- [ ] Fix the parser\n- [x] Fixed\n- [ ] Add the missing test\n",
			brief: BRIEF,
		});

		const result = await cleanup(root, { path: "mod", dryRun: false, allowEmptyPlan: false });

		expect(result).toEqual({
			kind: "refused",
			module: "mod",
			refusal: {
				kind: "unchecked-items",
				items: [
					{ file: "plan.aide", line: 4, text: "Wire the registry" },
					{ file: "todo.aide", line: 3, text: "Fix the parser" },
					{ file: "todo.aide", line: 5, text: "Add the missing test" },
				],
			},
		});
	});
});

describe("cleanup empty-plan opt-in", () => {
	it("refuses a plan without checkboxes by default and removes both files with allowEmptyPlan", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: PLAN_EMPTY, brief: BRIEF });

		const refused = await cleanup(root, { path: "mod", dryRun: false, allowEmptyPlan: false });

		expect(refused).toEqual({ kind: "refused", module: "mod", refusal: { kind: "plan-without-checkboxes" } });
		expect(existsSync(join(mod, "plan.aide"))).toBe(true);
		expect(existsSync(join(mod, "brief.aide"))).toBe(true);

		const removed = await cleanup(root, { path: "mod", dryRun: false, allowEmptyPlan: true });

		expect(removed).toEqual({ kind: "removed", module: "mod", files: ["brief.aide", "plan.aide"] });
		expect(existsSync(join(mod, "plan.aide"))).toBe(false);
		expect(existsSync(join(mod, "brief.aide"))).toBe(false);
	});

	it("still refuses an empty plan plus an unchecked todo item and removes nothing", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: PLAN_EMPTY, todo: TODO_UNCHECKED, brief: BRIEF });

		const result = await cleanup(root, { path: "mod", dryRun: false, allowEmptyPlan: true });

		expect(result).toEqual({
			kind: "refused",
			module: "mod",
			refusal: { kind: "unchecked-items", items: [{ file: "todo.aide", line: 4, text: "Fix the other thing" }] },
		});
		for (const name of EPHEMERALS) expect(existsSync(join(mod, name))).toBe(true);
	});
});

describe("cleanup dry-run parity", () => {
	type Fixture = { name: string; allowEmptyPlan: boolean; build: () => Promise<string> };

	const fixtures: Fixture[] = [
		{
			name: "closed",
			allowEmptyPlan: false,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "unchecked plan",
			allowEmptyPlan: false,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_UNCHECKED, todo: TODO_CHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "unchecked todo",
			allowEmptyPlan: false,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, todo: TODO_UNCHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "no plan",
			allowEmptyPlan: false,
			build: async () => (await makeModule(join(root, "mod"), { todo: TODO_CHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "plan without checkboxes (default)",
			allowEmptyPlan: false,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_EMPTY, brief: BRIEF }), "mod"),
		},
		{
			name: "plan without checkboxes with allowEmptyPlan",
			allowEmptyPlan: true,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_EMPTY, brief: BRIEF }), "mod"),
		},
		{
			name: "empty plan plus unchecked todo with allowEmptyPlan",
			allowEmptyPlan: true,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_EMPTY, todo: TODO_UNCHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "outside root",
			allowEmptyPlan: false,
			build: async () => (await makeModule(outside, { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF }), outside),
		},
		{
			name: "not a directory",
			allowEmptyPlan: false,
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, brief: BRIEF }), "mod/plan.aide"),
		},
	];

	it.each(fixtures)("dry run matches the real call: $name", async ({ build, allowEmptyPlan }) => {
		const path = await build();
		const before = await snapshot(base);

		const dryRun = await cleanup(root, { path, dryRun: true, allowEmptyPlan });

		expect(await snapshot(base)).toEqual(before);

		const real = await cleanup(root, { path, dryRun: false, allowEmptyPlan });

		if (dryRun.kind === "refused") {
			expect(real).toEqual(dryRun);
			return;
		}
		expect(dryRun.kind).toBe("would-remove");
		expect(real.kind).toBe("removed");
		expect(dryRun).toMatchObject({ files: (real as { files: string[] }).files });
	});
});

describe("cleanup file-system access", () => {
	type FsCall = { name: string; paths: string[] };
	const calls: FsCall[] = [];
	let run: typeof cleanup;

	/** Realpaths a recorded path, falling back to the real parent plus basename for files already unlinked. */
	async function normalize(path: string): Promise<string> {
		try {
			return await realpath(path);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			return join(await normalize(dirname(path)), basename(path));
		}
	}

	beforeEach(async () => {
		calls.length = 0;
		vi.resetModules();
		// doMock (not the hoisted vi.mock) keeps this recording wrapper scoped to this describe.
		vi.doMock("node:fs/promises", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:fs/promises")>();
			const wrapped = Object.fromEntries(
				Object.entries(actual).map(([name, value]) => [
					name,
					typeof value !== "function"
						? value
						: (...args: unknown[]) => {
								calls.push({ name, paths: args.filter((arg): arg is string => typeof arg === "string" && isAbsolute(arg)) });
								return (value as (...inner: unknown[]) => unknown)(...args);
							},
				]),
			);
			return { ...wrapped, default: wrapped };
		});
		run = (await import("./index.js")).default;
	});

	afterEach(() => {
		vi.doUnmock("node:fs/promises");
		vi.resetModules();
	});

	it.each([
		{ name: "a successful real call", contents: { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF }, kind: "removed" },
		{ name: "a refused call", contents: { plan: PLAN_UNCHECKED, todo: TODO_CHECKED, brief: BRIEF }, kind: "refused" },
	])("touches only the root, the module dir and its three ephemerals during $name", async ({ contents, kind }) => {
		const mod = join(root, "mod");
		await makeModule(mod, contents);
		for (const name of [".aide", "intent.aide", "research.aide", "index.ts", "session.aide"]) {
			await writeFile(join(mod, name), `content of ${name}`);
		}
		calls.length = 0;

		const result = await run(root, { path: "mod", dryRun: false, allowEmptyPlan: false });

		expect(result.kind).toBe(kind);
		const recorded = await Promise.all(calls.flatMap(({ paths }) => paths).map(normalize));
		const realMod = await realpath(mod);
		const allowed = [await realpath(root), realMod, ...EPHEMERALS.map((name) => join(realMod, name))];
		expect(recorded.length).toBeGreaterThan(0);
		for (const path of recorded) expect(allowed).toContain(path);
		const forbidden = ["session.aide", ".aide", "intent.aide", "research.aide", "index.ts"];
		for (const path of recorded) expect(forbidden).not.toContain(basename(path));
		expect(calls.filter(({ name }) => name === "readdir")).toEqual([]);
	});
});
