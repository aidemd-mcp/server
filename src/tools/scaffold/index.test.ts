import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readdir, readFile, rm, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scaffold from "./index.js";
import sessionTemplate from "./sessionTemplate/index.js";
import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";
import { GOVERNED_FIELDS } from "@/tools/frontmatter/governedFields/index.js";

const MODULE = "src/module";

let tempDir: string;
let moduleDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
	moduleDir = join(tempDir, MODULE);
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Gives MODULE the intent spec a plan needs beside it. */
async function seedSpec(): Promise<void> {
	await mkdir(moduleDir, { recursive: true });
	await writeFile(join(moduleDir, ".aide"), "intent spec");
}

describe("scaffold", () => {
	it("creates .aide for intent type when no research exists", async () => {
		const result = await scaffold(tempDir, MODULE, "intent");

		expect(result).toContain("Created .aide");
		const files = await readdir(moduleDir);
		expect(files).toContain(".aide");
	});

	it("creates intent.aide when research.aide already exists", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "research.aide"), "Research");

		const result = await scaffold(tempDir, MODULE, "intent");

		expect(result).toContain("Created intent.aide");
		const files = await readdir(moduleDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
	});

	it("creates research.aide and renames .aide to intent.aide", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, ".aide"), "Original intent");

		const result = await scaffold(tempDir, MODULE, "research");

		expect(result).toContain("Renamed .aide → intent.aide");
		expect(result).toContain("Created research.aide");

		const files = await readdir(moduleDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
		expect(files).not.toContain(".aide");

		// Verify original content was preserved in rename
		const content = await readFile(join(moduleDir, "intent.aide"), "utf-8");
		expect(content).toBe("Original intent");
	});

	it("creates both files for type=both", async () => {
		const result = await scaffold(tempDir, MODULE, "both");

		expect(result).toContain("Created intent.aide");
		expect(result).toContain("Created research.aide");

		const files = await readdir(moduleDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
	});

	it("creates todo.aide for type=todo", async () => {
		const result = await scaffold(tempDir, ".", "todo");

		expect(result).toContain("Created todo.aide");
		const files = await readdir(tempDir);
		expect(files).toContain("todo.aide");

		const content = await readFile(join(tempDir, "todo.aide"), "utf-8");
		expect(content).toContain("QA Re-alignment Document");
		expect(content).toContain("description:");
	});

	it("intent template includes frontmatter with description and scope", async () => {
		await scaffold(tempDir, MODULE, "intent");

		const content = await readFile(join(moduleDir, ".aide"), "utf-8");
		expect(content).toContain("---");
		expect(content).toContain("scope:");
		expect(content).toContain("description:");
		expect(content).toContain("intent:");
		expect(content).toContain("outcomes:");
	});

	it("plan template carries status and intent and no description", async () => {
		await seedSpec();
		await scaffold(tempDir, MODULE, "plan");

		const content = await readFile(join(moduleDir, "plan.aide"), "utf-8");
		expect(content).toContain("status: proposed");
		expect(content).toContain("intent:");
		expect(content).not.toContain("description:");
	});

	it("creates directory if it does not exist", async () => {
		const subDir = join(tempDir, "new", "nested");

		await scaffold(tempDir, "new/nested", "intent");

		const files = await readdir(subDir);
		expect(files).toContain(".aide");
	});
});

const SKIP_TAIL = "it already exists and was left untouched";

describe("scaffold session type", () => {
	it("creates .aide/session.aide from the session template on an empty root", async () => {
		const result = await scaffold(tempDir, ".", "session");

		expect(result).toBe("Created .aide/session.aide");
		const content = await readFile(join(tempDir, ".aide", "session.aide"), "utf-8");
		expect(content).toBe(sessionTemplate);
	});

	it("lands at the project root for a nested directory and never creates that directory", async () => {
		const result = await scaffold(tempDir, "src/deep/nested", "session");

		expect(result).toBe("Created .aide/session.aide");
		expect(await readFile(join(tempDir, ".aide", "session.aide"), "utf-8")).toBe(sessionTemplate);
		await expect(stat(join(tempDir, "src"))).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("lands at the project root for an absolute directory elsewhere and never creates it", async () => {
		const elsewhere = join(tempDir, "elsewhere", "absolute");

		const result = await scaffold(tempDir, elsewhere, "session");

		expect(result).toBe("Created .aide/session.aide");
		expect(await readFile(join(tempDir, ".aide", "session.aide"), "utf-8")).toBe(sessionTemplate);
		await expect(stat(join(tempDir, "elsewhere"))).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("skips a filled existing session record and leaves its bytes identical", async () => {
		await mkdir(join(tempDir, ".aide"));
		const target = join(tempDir, ".aide", "session.aide");
		await writeFile(target, "filled session record\n");

		const result = await scaffold(tempDir, ".", "session");

		expect(result).toBe(`Skipped .aide/session.aide — ${SKIP_TAIL}`);
		expect(await readFile(target, "utf-8")).toBe("filled session record\n");
	});

	it("skips an existing byte-identical placeholder", async () => {
		await mkdir(join(tempDir, ".aide"));
		const target = join(tempDir, ".aide", "session.aide");
		await writeFile(target, sessionTemplate);

		const result = await scaffold(tempDir, ".", "session");

		expect(result).toBe(`Skipped .aide/session.aide — ${SKIP_TAIL}`);
		expect(await readFile(target, "utf-8")).toBe(sessionTemplate);
	});
});

describe("scaffold never overwrites", () => {
	it.each([
		["todo", "todo.aide", "."],
		["plan", "plan.aide", MODULE],
		["intent", ".aide", MODULE],
	] as const)("type=%s over a filled %s is skipped and unchanged", async (type, name, directory) => {
		const target = join(tempDir, directory, name);
		await mkdir(join(tempDir, directory), { recursive: true });
		if (type === "plan") await writeFile(join(tempDir, directory, ".aide"), "intent spec");
		await writeFile(target, "filled content");

		const result = await scaffold(tempDir, directory, type);

		expect(result).toContain(`Skipped ${name}`);
		expect(result).toContain("left untouched");
		expect(await readFile(target, "utf-8")).toBe("filled content");
	});

	it("type=intent over a filled intent.aide with research.aide present uses the plain skip line", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "intent.aide"), "filled intent");
		await writeFile(join(moduleDir, "research.aide"), "filled research");

		const result = await scaffold(tempDir, MODULE, "intent");

		expect(result).toBe(`Skipped intent.aide — ${SKIP_TAIL}`);
		expect(await readFile(join(moduleDir, "intent.aide"), "utf-8")).toBe("filled intent");
	});

	it("type=research over a filled research.aide is skipped, unchanged, and does not rename", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "research.aide"), "filled research");
		await writeFile(join(moduleDir, ".aide"), "filled intent");

		const result = await scaffold(tempDir, MODULE, "research");

		expect(result).toBe(`Skipped research.aide — ${SKIP_TAIL}`);
		expect(await readFile(join(moduleDir, "research.aide"), "utf-8")).toBe("filled research");
		expect(await readFile(join(moduleDir, ".aide"), "utf-8")).toBe("filled intent");
		expect(await readdir(moduleDir)).not.toContain("intent.aide");
	});

	it("type=intent into a folder holding only intent.aide creates no .aide and reports the cross-form skip", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "intent.aide"), "filled intent");

		const result = await scaffold(tempDir, MODULE, "intent");

		expect(result).toBe(
			"Skipped .aide — intent.aide already holds this folder's intent spec and was left untouched",
		);
		expect(await readdir(moduleDir)).toEqual(["intent.aide"]);
		expect(await readFile(join(moduleDir, "intent.aide"), "utf-8")).toBe("filled intent");
	});

	it("type=intent with research.aide and only .aide present reports the cross-form skip for intent.aide", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, ".aide"), "filled intent");
		await writeFile(join(moduleDir, "research.aide"), "filled research");

		const result = await scaffold(tempDir, MODULE, "intent");

		expect(result).toBe(
			"Skipped intent.aide — .aide already holds this folder's intent spec and was left untouched",
		);
		expect(await readdir(moduleDir)).not.toContain("intent.aide");
	});

	it("type=both with both files filled returns two Skipped lines and changes nothing", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "intent.aide"), "filled intent");
		await writeFile(join(moduleDir, "research.aide"), "filled research");

		const result = await scaffold(tempDir, MODULE, "both");

		expect(result.split("\n")).toEqual([
			`Skipped intent.aide — ${SKIP_TAIL}`,
			`Skipped research.aide — ${SKIP_TAIL}`,
		]);
		expect(await readFile(join(moduleDir, "intent.aide"), "utf-8")).toBe("filled intent");
		expect(await readFile(join(moduleDir, "research.aide"), "utf-8")).toBe("filled research");
	});

	it.each(["intent", "research", "both", "todo", "plan", "session"] as const)(
		"type=%s returns plain text lines, never JSON",
		async (type) => {
			const directory = type === "plan" ? MODULE : ".";
			if (type === "plan") await seedSpec();
			const created = await scaffold(tempDir, directory, type);
			const skipped = await scaffold(tempDir, directory, type);

			expect(created.startsWith("{")).toBe(false);
			expect(skipped.startsWith("{")).toBe(false);
		},
	);
});

describe("scaffold plan refusal", () => {
	const refusal = (directory: string) =>
		`Refused plan.aide — ${directory} holds no intent spec (.aide or intent.aide); write the folder's intent spec first, then scaffold the plan`;

	it("refuses a missing folder and does not create it", async () => {
		const result = await scaffold(tempDir, "src/new", "plan");

		expect(result).toBe(refusal("src/new"));
		await expect(stat(join(tempDir, "src/new"))).rejects.toThrow();
	});

	it("refuses an existing empty folder and leaves it empty", async () => {
		await mkdir(moduleDir, { recursive: true });

		const result = await scaffold(tempDir, MODULE, "plan");

		expect(result).toBe(refusal(MODULE));
		expect(await readdir(moduleDir)).toEqual([]);
	});

	it("refuses a folder holding only research.aide", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "research.aide"), "Research");

		const result = await scaffold(tempDir, MODULE, "plan");

		expect(result).toBe(refusal(MODULE));
		expect(await readdir(moduleDir)).toEqual(["research.aide"]);
	});

	it("creates plan.aide in a folder holding .aide", async () => {
		await seedSpec();

		expect(await scaffold(tempDir, MODULE, "plan")).toBe("Created plan.aide");
	});

	it("creates plan.aide in a folder holding intent.aide and research.aide", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "intent.aide"), "intent spec");
		await writeFile(join(moduleDir, "research.aide"), "Research");

		expect(await scaffold(tempDir, MODULE, "plan")).toBe("Created plan.aide");
	});

	it("refuses a spec-less folder that already holds a filled plan.aide and leaves the plan unchanged", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "plan.aide"), "filled plan");

		const result = await scaffold(tempDir, MODULE, "plan");

		expect(result).toBe(refusal(MODULE));
		expect(await readFile(join(moduleDir, "plan.aide"), "utf-8")).toBe("filled plan");
	});

	it("does not mistake the .aide methodology folder at the project root for a spec", async () => {
		await mkdir(join(tempDir, ".aide"), { recursive: true });

		const result = await scaffold(tempDir, ".", "plan");

		expect(result).toBe(refusal("."));
		await expect(stat(join(tempDir, "plan.aide"))).rejects.toThrow();
	});

	it.each([
		["intent", [join(MODULE, ".aide")]],
		["research", [join(MODULE, "research.aide")]],
		["both", [join(MODULE, "intent.aide"), join(MODULE, "research.aide")]],
		["todo", [join(MODULE, "todo.aide")]],
		["session", [join(".aide", "session.aide")]],
	] as const)("does not leak: type=%s still creates its file in a spec-less folder", async (type, files) => {
		await scaffold(tempDir, MODULE, type);

		for (const file of files) await expect(stat(join(tempDir, file))).resolves.toBeDefined();
	});

	it("the refusal is one line of plain text, not JSON", async () => {
		const result = await scaffold(tempDir, MODULE, "plan");

		expect(result.includes("\n")).toBe(false);
		expect(result.startsWith("{")).toBe(false);
	});
});

describe("scaffold starting values", () => {
	const cases = [
		{ label: "intent (.aide)", type: "intent", directory: MODULE, file: ".aide", kind: "intent-spec" },
		{ label: "plan", type: "plan", directory: MODULE, file: "plan.aide", kind: "plan" },
		{ label: "todo", type: "todo", directory: ".", file: "todo.aide", kind: "todo" },
	] as const;

	it.each(cases)("a created $label starts at its kind's initial value", async ({ type, directory, file, kind }) => {
		if (type === "plan") await seedSpec();
		await scaffold(tempDir, directory, type);

		const read = readGovernedValue({ content: await readFile(join(tempDir, directory, file), "utf-8"), kind });

		expect(read).toMatchObject({
			status: "ok",
			current: { state: "set", value: GOVERNED_FIELDS[kind].initial },
			legacy: false,
		});
	});

	it("a created intent.aide starts at the intent spec's initial value", async () => {
		await mkdir(moduleDir, { recursive: true });
		await writeFile(join(moduleDir, "research.aide"), "Research");

		await scaffold(tempDir, MODULE, "intent");

		const read = readGovernedValue({
			content: await readFile(join(moduleDir, "intent.aide"), "utf-8"),
			kind: "intent-spec",
		});
		expect(read).toMatchObject({
			status: "ok",
			current: { state: "set", value: GOVERNED_FIELDS["intent-spec"].initial },
			legacy: false,
		});
	});

	it("a created research.aide and .aide/session.aide carry no alignment or status line", async () => {
		await scaffold(tempDir, MODULE, "research");
		await scaffold(tempDir, ".", "session");

		for (const file of [join(MODULE, "research.aide"), join(".aide", "session.aide")]) {
			const content = await readFile(join(tempDir, file), "utf-8");
			expect(content).not.toMatch(/^(alignment|status):/m);
		}
	});
});

describe("scaffold root intent spec", () => {
	const CREATED_LINE =
		"Created .aide/intent.aide (the project root intent spec always takes the explicit name)";
	const RENAMED_LINE =
		"Renamed .aide/.aide → .aide/intent.aide (the project root intent spec always takes the explicit name; its content is kept)";
	const SKIPPED_LINE = `Skipped .aide/intent.aide — ${SKIP_TAIL}`;

	let aideDir: string;

	beforeEach(async () => {
		aideDir = join(tempDir, ".aide");
	});

	/** Reads the intent template text through a fresh scaffold into a throwaway module folder. */
	async function readIntentTemplate(): Promise<string> {
		await scaffold(tempDir, "template-source", "both");
		return readFile(join(tempDir, "template-source", "intent.aide"), "utf-8");
	}

	it("creates .aide/intent.aide for directory .aide on a fresh project", async () => {
		const result = await scaffold(tempDir, ".aide", "intent");

		expect(result).toBe(CREATED_LINE);
		const created = await readFile(join(aideDir, "intent.aide"), "utf-8");
		expect(created).toBe(await readIntentTemplate());
		expect(await readdir(aideDir)).toEqual(["intent.aide"]);
	});

	it("treats directory . as the project's .aide folder on a fresh project", async () => {
		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toBe(CREATED_LINE);
		expect((await stat(aideDir)).isDirectory()).toBe(true);
		expect(await readdir(aideDir)).toEqual(["intent.aide"]);
		expect(await readdir(tempDir)).not.toContain("intent.aide");
	});

	it("renames a bare .aide/.aide to intent.aide and keeps its content", async () => {
		await mkdir(aideDir);
		await writeFile(join(aideDir, ".aide"), "filled root body\n");

		const result = await scaffold(tempDir, ".aide", "intent");

		expect(result).toBe(RENAMED_LINE);
		expect(await readFile(join(aideDir, "intent.aide"), "utf-8")).toBe("filled root body\n");
		expect(await readdir(aideDir)).not.toContain(".aide");
	});

	it("skips when intent.aide exists, even beside a bare .aide, and changes nothing", async () => {
		await mkdir(aideDir);
		await writeFile(join(aideDir, ".aide"), "bare body");
		await writeFile(join(aideDir, "intent.aide"), "explicit body");

		const result = await scaffold(tempDir, ".aide", "intent");

		expect(result).toBe(SKIPPED_LINE);
		expect(await readFile(join(aideDir, ".aide"), "utf-8")).toBe("bare body");
		expect(await readFile(join(aideDir, "intent.aide"), "utf-8")).toBe("explicit body");
	});

	it("renames a bare .aide/.aide even when research.aide is present", async () => {
		await mkdir(aideDir);
		await writeFile(join(aideDir, ".aide"), "root body");
		await writeFile(join(aideDir, "research.aide"), "root research");

		const result = await scaffold(tempDir, ".aide", "intent");

		expect(result).toBe(RENAMED_LINE);
		expect(await readFile(join(aideDir, "intent.aide"), "utf-8")).toBe("root body");
		expect(await readFile(join(aideDir, "research.aide"), "utf-8")).toBe("root research");
	});

	it("a created root intent.aide starts at the intent spec's initial value", async () => {
		await scaffold(tempDir, ".aide", "intent");

		const read = readGovernedValue({
			content: await readFile(join(aideDir, "intent.aide"), "utf-8"),
			kind: "intent-spec",
		});
		expect(read).toMatchObject({
			status: "ok",
			current: { state: "set", value: GOVERNED_FIELDS["intent-spec"].initial },
			legacy: false,
		});
	});

	it("type=research at . leaves a populated .aide folder intact and creates .aide/research.aide", async () => {
		await mkdir(aideDir);
		await writeFile(join(aideDir, "session.aide"), "session text");

		const result = await scaffold(tempDir, ".", "research");

		expect(result).toBe("Created research.aide");
		expect((await stat(aideDir)).isDirectory()).toBe(true);
		expect(await readFile(join(aideDir, "session.aide"), "utf-8")).toBe("session text");
		expect(await readdir(aideDir)).toContain("research.aide");
		expect(await readdir(tempDir)).not.toContain("intent.aide");
	});

	it("type=both at . creates .aide/intent.aide and .aide/research.aide", async () => {
		const result = await scaffold(tempDir, ".", "both");

		expect(result.split("\n")).toEqual(["Created intent.aide", "Created research.aide"]);
		expect((await readdir(aideDir)).sort()).toEqual(["intent.aide", "research.aide"]);
	});

	it("a module folder holding a directory named .aide is not renamed by type=research", async () => {
		await mkdir(join(moduleDir, ".aide"), { recursive: true });

		const result = await scaffold(tempDir, MODULE, "research");

		expect(result).toBe("Created research.aide");
		expect((await stat(join(moduleDir, ".aide"))).isDirectory()).toBe(true);
		expect((await readdir(moduleDir)).sort()).toEqual([".aide", "research.aide"]);
	});
});
