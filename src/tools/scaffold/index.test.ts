import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readdir, readFile, rm, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scaffold from "./index.js";
import sessionTemplate from "./sessionTemplate/index.js";
import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";
import { GOVERNED_FIELDS } from "@/tools/frontmatter/governedFields/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("scaffold", () => {
	it("creates .aide for intent type when no research exists", async () => {
		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toContain("Created .aide");
		const files = await readdir(tempDir);
		expect(files).toContain(".aide");
	});

	it("creates intent.aide when research.aide already exists", async () => {
		await writeFile(join(tempDir, "research.aide"), "Research");

		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toContain("Created intent.aide");
		const files = await readdir(tempDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
	});

	it("creates research.aide and renames .aide to intent.aide", async () => {
		await writeFile(join(tempDir, ".aide"), "Original intent");

		const result = await scaffold(tempDir, ".", "research");

		expect(result).toContain("Renamed .aide → intent.aide");
		expect(result).toContain("Created research.aide");

		const files = await readdir(tempDir);
		expect(files).toContain("intent.aide");
		expect(files).toContain("research.aide");
		expect(files).not.toContain(".aide");

		// Verify original content was preserved in rename
		const content = await readFile(join(tempDir, "intent.aide"), "utf-8");
		expect(content).toBe("Original intent");
	});

	it("creates both files for type=both", async () => {
		const result = await scaffold(tempDir, ".", "both");

		expect(result).toContain("Created intent.aide");
		expect(result).toContain("Created research.aide");

		const files = await readdir(tempDir);
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
		await scaffold(tempDir, ".", "intent");

		const content = await readFile(join(tempDir, ".aide"), "utf-8");
		expect(content).toContain("---");
		expect(content).toContain("scope:");
		expect(content).toContain("description:");
		expect(content).toContain("intent:");
		expect(content).toContain("outcomes:");
	});

	it("plan template includes frontmatter with description", async () => {
		await scaffold(tempDir, ".", "plan");

		const content = await readFile(join(tempDir, "plan.aide"), "utf-8");
		expect(content).toContain("---");
		expect(content).toContain("description:");
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
		["todo", "todo.aide"],
		["plan", "plan.aide"],
		["intent", ".aide"],
	] as const)("type=%s over a filled %s is skipped and unchanged", async (type, name) => {
		const target = join(tempDir, name);
		await writeFile(target, "filled content");

		const result = await scaffold(tempDir, ".", type);

		expect(result).toContain(`Skipped ${name}`);
		expect(result).toContain("left untouched");
		expect(await readFile(target, "utf-8")).toBe("filled content");
	});

	it("type=intent over a filled intent.aide with research.aide present uses the plain skip line", async () => {
		await writeFile(join(tempDir, "intent.aide"), "filled intent");
		await writeFile(join(tempDir, "research.aide"), "filled research");

		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toBe(`Skipped intent.aide — ${SKIP_TAIL}`);
		expect(await readFile(join(tempDir, "intent.aide"), "utf-8")).toBe("filled intent");
	});

	it("type=research over a filled research.aide is skipped, unchanged, and does not rename", async () => {
		await writeFile(join(tempDir, "research.aide"), "filled research");
		await writeFile(join(tempDir, ".aide"), "filled intent");

		const result = await scaffold(tempDir, ".", "research");

		expect(result).toBe(`Skipped research.aide — ${SKIP_TAIL}`);
		expect(await readFile(join(tempDir, "research.aide"), "utf-8")).toBe("filled research");
		expect(await readFile(join(tempDir, ".aide"), "utf-8")).toBe("filled intent");
		expect(await readdir(tempDir)).not.toContain("intent.aide");
	});

	it("type=intent into a folder holding only intent.aide creates no .aide and reports the cross-form skip", async () => {
		await writeFile(join(tempDir, "intent.aide"), "filled intent");

		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toBe(
			"Skipped .aide — intent.aide already holds this folder's intent spec and was left untouched",
		);
		expect(await readdir(tempDir)).toEqual(["intent.aide"]);
		expect(await readFile(join(tempDir, "intent.aide"), "utf-8")).toBe("filled intent");
	});

	it("type=intent with research.aide and only .aide present reports the cross-form skip for intent.aide", async () => {
		await writeFile(join(tempDir, ".aide"), "filled intent");
		await writeFile(join(tempDir, "research.aide"), "filled research");

		const result = await scaffold(tempDir, ".", "intent");

		expect(result).toBe(
			"Skipped intent.aide — .aide already holds this folder's intent spec and was left untouched",
		);
		expect(await readdir(tempDir)).not.toContain("intent.aide");
	});

	it("type=both with both files filled returns two Skipped lines and changes nothing", async () => {
		await writeFile(join(tempDir, "intent.aide"), "filled intent");
		await writeFile(join(tempDir, "research.aide"), "filled research");

		const result = await scaffold(tempDir, ".", "both");

		expect(result.split("\n")).toEqual([
			`Skipped intent.aide — ${SKIP_TAIL}`,
			`Skipped research.aide — ${SKIP_TAIL}`,
		]);
		expect(await readFile(join(tempDir, "intent.aide"), "utf-8")).toBe("filled intent");
		expect(await readFile(join(tempDir, "research.aide"), "utf-8")).toBe("filled research");
	});

	it.each(["intent", "research", "both", "todo", "plan", "session"] as const)(
		"type=%s returns plain text lines, never JSON",
		async (type) => {
			const created = await scaffold(tempDir, ".", type);
			const skipped = await scaffold(tempDir, ".", type);

			expect(created.startsWith("{")).toBe(false);
			expect(skipped.startsWith("{")).toBe(false);
		},
	);
});

describe("scaffold starting values", () => {
	const cases = [
		{ label: "intent (.aide)", type: "intent", file: ".aide", kind: "intent-spec" },
		{ label: "plan", type: "plan", file: "plan.aide", kind: "plan" },
		{ label: "todo", type: "todo", file: "todo.aide", kind: "todo" },
	] as const;

	it.each(cases)("a created $label starts at its kind's initial value", async ({ type, file, kind }) => {
		await scaffold(tempDir, ".", type);

		const read = readGovernedValue({ content: await readFile(join(tempDir, file), "utf-8"), kind });

		expect(read).toMatchObject({
			status: "ok",
			current: { state: "set", value: GOVERNED_FIELDS[kind].initial },
			legacy: false,
		});
	});

	it("a created intent.aide starts at the intent spec's initial value", async () => {
		await writeFile(join(tempDir, "research.aide"), "Research");

		await scaffold(tempDir, ".", "intent");

		const read = readGovernedValue({
			content: await readFile(join(tempDir, "intent.aide"), "utf-8"),
			kind: "intent-spec",
		});
		expect(read).toMatchObject({
			status: "ok",
			current: { state: "set", value: GOVERNED_FIELDS["intent-spec"].initial },
			legacy: false,
		});
	});

	it("a created research.aide and .aide/session.aide carry no alignment or status line", async () => {
		await scaffold(tempDir, ".", "research");
		await scaffold(tempDir, ".", "session");

		for (const file of ["research.aide", join(".aide", "session.aide")]) {
			const content = await readFile(join(tempDir, file), "utf-8");
			expect(content).not.toMatch(/^(alignment|status):/m);
		}
	});
});
