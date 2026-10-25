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
const TODO_EMPTY = "# Todo\n\n## Retro\n\nNo checkboxes.\n";
const BRIEF = "# Brief\n\n- [ ] Not a checkbox contract\n";

/** Prefixes a body with a frontmatter block recording the given status value. */
function withStatus(status: string, body: string): string {
	return `---\nstatus: ${status}\n---\n${body}`;
}

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
	it("defaults dryRun to false", () => {
		expect(CleanupInput.parse({ path: "src/x" })).toEqual({ path: "src/x", dryRun: false });
	});

	it("drops an allowEmptyPlan key a caller still sends", () => {
		expect(CleanupInput.parse({ path: "src/x", allowEmptyPlan: true })).not.toHaveProperty("allowEmptyPlan");
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

		const result = await cleanup(root, { path: "parent/mod", dryRun: false });

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

		const result = await cleanup(root, { path: ".", dryRun: false });

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

		const result = await cleanup(root, { path: path(), dryRun: false });

		expect(result.kind).toBe("refused");
		expect(result).toMatchObject({ refusal });
		expect(await snapshot(base)).toEqual(before);
	});

	it("refuses a junction that escapes the root and changes nothing", async () => {
		await symlink(outside, join(root, "link"), "junction");
		const before = await snapshot(base);

		const result = await cleanup(root, { path: "link", dryRun: false });

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

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result.kind).toBe("refused");
		expect(await snapshot(mod)).toEqual(before);
		for (const [name, key] of [["plan.aide", "plan"], ["todo.aide", "todo"], ["brief.aide", "brief"]] as const) {
			expect(existsSync(join(mod, name))).toBe(key in contents);
		}
	});

	it("never blocks on a missing todo", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: PLAN_CHECKED, brief: BRIEF });

		const result = await cleanup(root, { path: "mod", dryRun: false });

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

		const result = await cleanup(root, { path: "mod", dryRun: false });

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

describe("cleanup without a plan", () => {
	const NEIGHBOURS = [".aide", "index.ts", "session.aide"];

	/** Builds a module with the given ephemerals plus the non-ephemeral neighbours that must survive. */
	async function makeNeighbouredModule(contents: ModuleContents) {
		const mod = join(root, "mod");
		await makeModule(mod, contents);
		for (const name of NEIGHBOURS) await writeFile(join(mod, name), `content of ${name}`);
		return mod;
	}

	it("removes a fully checked todo alone and leaves its neighbours", async () => {
		await makeNeighbouredModule({ todo: TODO_CHECKED });
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({ kind: "removed", module: "mod", files: ["todo.aide"] });
		const expected = Object.fromEntries(Object.entries(before).filter(([file]) => file !== "mod/todo.aide"));
		expect(await snapshot(root)).toEqual(expected);
	});

	it("refuses a todo with an unchecked item, naming it, and changes nothing", async () => {
		await makeNeighbouredModule({ todo: TODO_UNCHECKED });
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({
			kind: "refused",
			module: "mod",
			refusal: { kind: "unchecked-items", items: [{ file: "todo.aide", line: 4, text: "Fix the other thing" }] },
		});
		expect(await snapshot(root)).toEqual(before);
	});

	it("refuses a todo with no checkboxes and changes nothing", async () => {
		await makeNeighbouredModule({ todo: TODO_EMPTY });
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({ kind: "refused", module: "mod", refusal: { kind: "todo-without-checkboxes" } });
		expect(await snapshot(root)).toEqual(before);
	});

	it("refuses a brief alone and changes nothing", async () => {
		await makeNeighbouredModule({ brief: BRIEF });
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({ kind: "refused", module: "mod", refusal: { kind: "brief-without-plan", items: [] } });
		expect(await snapshot(root)).toEqual(before);
	});

	it("refuses a brief plus an unchecked todo, naming the todo item, and changes nothing", async () => {
		await makeNeighbouredModule({ todo: TODO_UNCHECKED, brief: BRIEF });
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({
			kind: "refused",
			module: "mod",
			refusal: { kind: "brief-without-plan", items: [{ file: "todo.aide", line: 4, text: "Fix the other thing" }] },
		});
		expect(await snapshot(root)).toEqual(before);
	});
});

describe("cleanup folder refusals", () => {
	it("refuses a missing folder and changes nothing", async () => {
		const before = await snapshot(base);

		const result = await cleanup(root, { path: "nope", dryRun: false });

		expect(result).toMatchObject({ kind: "refused", refusal: { kind: "missing" } });
		expect(await snapshot(base)).toEqual(before);
	});

	it("refuses a folder holding no ephemerals and changes nothing", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, {});
		await writeFile(join(mod, ".aide"), "content of .aide");
		await writeFile(join(mod, "index.ts"), "content of index.ts");
		const before = await snapshot(base);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({ kind: "refused", module: "mod", refusal: { kind: "no-ephemerals" } });
		expect(await snapshot(base)).toEqual(before);
	});
});

describe("cleanup by recorded status", () => {
	it("refuses a status-less plan without checkboxes and removes nothing", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: PLAN_EMPTY, brief: BRIEF });

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({ kind: "refused", module: "mod", refusal: { kind: "plan-without-checkboxes" } });
		expect(existsSync(join(mod, "plan.aide"))).toBe(true);
		expect(existsSync(join(mod, "brief.aide"))).toBe(true);
	});

	it("removes an abandoned plan with open items plus an approved brief and leaves neighbours byte-identical", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: withStatus("abandoned", PLAN_UNCHECKED), brief: withStatus("approved", BRIEF) });
		for (const name of [".aide", "index.ts", "session.aide"]) await writeFile(join(mod, name), `content of ${name}`);
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({ kind: "removed", module: "mod", files: ["brief.aide", "plan.aide"] });
		const expected = Object.fromEntries(
			Object.entries(before).filter(([file]) => file !== "mod/plan.aide" && file !== "mod/brief.aide"),
		);
		expect(await snapshot(root)).toEqual(expected);
	});

	it("refuses a proposed plan and removes nothing", async () => {
		const mod = join(root, "mod");
		await makeModule(mod, { plan: withStatus("proposed", PLAN_CHECKED), todo: TODO_CHECKED, brief: BRIEF });
		const before = await snapshot(root);

		const result = await cleanup(root, { path: "mod", dryRun: false });

		expect(result).toEqual({
			kind: "refused",
			module: "mod",
			refusal: { kind: "open-status", files: [{ file: "plan.aide", status: "proposed" }], items: [] },
		});
		expect(await snapshot(root)).toEqual(before);
	});
});

describe("cleanup dry-run parity", () => {
	type Fixture = { name: string; build: () => Promise<string> };

	const fixtures: Fixture[] = [
		{
			name: "closed",
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "unchecked plan",
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_UNCHECKED, todo: TODO_CHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "unchecked todo",
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, todo: TODO_UNCHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "no plan",
			build: async () => (await makeModule(join(root, "mod"), { todo: TODO_CHECKED, brief: BRIEF }), "mod"),
		},
		{
			name: "plan without checkboxes",
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_EMPTY, brief: BRIEF }), "mod"),
		},
		{
			name: "todo only, checked",
			build: async () => (await makeModule(join(root, "mod"), { todo: TODO_CHECKED }), "mod"),
		},
		{
			name: "todo only, unchecked",
			build: async () => (await makeModule(join(root, "mod"), { todo: TODO_UNCHECKED }), "mod"),
		},
		{
			name: "todo only, no checkboxes",
			build: async () => (await makeModule(join(root, "mod"), { todo: TODO_EMPTY }), "mod"),
		},
		{
			name: "brief only",
			build: async () => (await makeModule(join(root, "mod"), { brief: BRIEF }), "mod"),
		},
		{
			name: "completed plan plus completed brief",
			build: async () =>
				(await makeModule(join(root, "mod"), { plan: withStatus("completed", PLAN_CHECKED), brief: withStatus("completed", BRIEF) }), "mod"),
		},
		{
			name: "abandoned plan plus brief",
			build: async () =>
				(await makeModule(join(root, "mod"), { plan: withStatus("abandoned", PLAN_UNCHECKED), brief: withStatus("approved", BRIEF) }), "mod"),
		},
		{
			name: "abandoned plan plus approved todo",
			build: async () =>
				(await makeModule(join(root, "mod"), { plan: withStatus("abandoned", PLAN_UNCHECKED), todo: withStatus("approved", TODO_CHECKED) }), "mod"),
		},
		{
			name: "completed todo alone",
			build: async () => (await makeModule(join(root, "mod"), { todo: withStatus("completed", TODO_CHECKED) }), "mod"),
		},
		{
			name: "completed plan with an open item",
			build: async () => (await makeModule(join(root, "mod"), { plan: withStatus("completed", PLAN_UNCHECKED) }), "mod"),
		},
		{
			name: "no ephemerals",
			build: async () => {
				await makeModule(join(root, "mod"), {});
				await writeFile(join(root, "mod", "index.ts"), "content of index.ts");
				return "mod";
			},
		},
		{
			name: "missing folder",
			build: async () => "nope",
		},
		{
			name: "outside root",
			build: async () => (await makeModule(outside, { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF }), outside),
		},
		{
			name: "not a directory",
			build: async () => (await makeModule(join(root, "mod"), { plan: PLAN_CHECKED, brief: BRIEF }), "mod/plan.aide"),
		},
	];

	it.each(fixtures)("dry run matches the real call: $name", async ({ build }) => {
		const path = await build();
		const before = await snapshot(base);

		const dryRun = await cleanup(root, { path, dryRun: true });

		expect(await snapshot(base)).toEqual(before);

		const real = await cleanup(root, { path, dryRun: false });

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
		{ name: "a successful real call", path: "mod", contents: { plan: PLAN_CHECKED, todo: TODO_CHECKED, brief: BRIEF }, kind: "removed" },
		{ name: "a todo-only real call", path: "mod", contents: { todo: TODO_CHECKED }, kind: "removed" },
		{ name: "a refused call", path: "mod", contents: { plan: PLAN_UNCHECKED, todo: TODO_CHECKED, brief: BRIEF }, kind: "refused" },
		{
			name: "a project-root call beside an abandoned session.aide",
			path: ".",
			contents: { plan: withStatus("completed", PLAN_CHECKED), todo: TODO_CHECKED, brief: BRIEF },
			kind: "removed",
		},
	])("touches only the root, the module dir and its three ephemerals during $name", async ({ contents, kind, path }) => {
		const mod = path === "." ? root : join(root, path);
		await makeModule(mod, contents);
		for (const name of ["intent.aide", "research.aide", "index.ts", "session.aide"]) {
			await writeFile(join(mod, name), `content of ${name}`);
		}
		if (path === ".") {
			await mkdir(join(mod, ".aide"));
			await writeFile(join(mod, ".aide", "session.aide"), withStatus("abandoned", "session state\n"));
		} else {
			await writeFile(join(mod, ".aide"), "content of .aide");
		}
		const sessionBefore = path === "." ? await readFile(join(mod, ".aide", "session.aide"), "utf-8") : null;
		calls.length = 0;

		const result = await run(root, { path, dryRun: false });

		expect(result.kind).toBe(kind);
		const recorded = await Promise.all(calls.flatMap(({ paths }) => paths).map(normalize));
		const realMod = await realpath(mod);
		const allowed = [await realpath(root), realMod, ...EPHEMERALS.map((name) => join(realMod, name))];
		expect(recorded.length).toBeGreaterThan(0);
		for (const recordedPath of recorded) expect(allowed).toContain(recordedPath);
		const forbidden = ["session.aide", ".aide", "intent.aide", "research.aide", "index.ts"];
		for (const recordedPath of recorded) expect(forbidden).not.toContain(basename(recordedPath));
		expect(calls.filter(({ name }) => name === "readdir")).toEqual([]);
		if (sessionBefore !== null) expect(await readFile(join(mod, ".aide", "session.aide"), "utf-8")).toBe(sessionBefore);
	});
});
