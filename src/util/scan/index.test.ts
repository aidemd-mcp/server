import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import * as fsPromises from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scan from "./index.js";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, readFile: vi.fn(actual.readFile) };
});

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scan-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("scan", () => {
	it("finds .aide files recursively", async () => {
		await mkdir(join(tempDir, "sub"), { recursive: true });
		await writeFile(join(tempDir, ".aide"), "Root intent spec for the project");
		await writeFile(join(tempDir, "sub", "research.aide"), "Research data and sources");

		const result = await scan(tempDir);

		expect(result.root).toBe(tempDir);
		expect(result.files).toHaveLength(2);

		const paths = result.files.map((f) => f.relativePath);
		expect(paths).toContain(".aide");
		expect(paths).toContain("sub/research.aide");
	});

	it("classifies file types correctly", async () => {
		await writeFile(join(tempDir, ".aide"), "Intent content");
		await writeFile(join(tempDir, "research.aide"), "Research content");
		await writeFile(join(tempDir, "todo.aide"), "- [ ] Check something");

		const result = await scan(tempDir);
		const byType = Object.fromEntries(result.files.map((f) => [f.type, f.relativePath]));

		expect(byType.intent).toBe(".aide");
		expect(byType.research).toBe("research.aide");
		expect(byType.todo).toBe("todo.aide");
	});

	it("skips node_modules and .git directories", async () => {
		await mkdir(join(tempDir, "node_modules", "pkg"), { recursive: true });
		await mkdir(join(tempDir, ".git", "hooks"), { recursive: true });
		await writeFile(join(tempDir, "node_modules", "pkg", ".aide"), "Should be skipped");
		await writeFile(join(tempDir, ".git", "hooks", ".aide"), "Should be skipped");
		await writeFile(join(tempDir, ".aide"), "Should be found");

		const result = await scan(tempDir);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].relativePath).toBe(".aide");
	});

	it("extracts checkbox summary for plan files", async () => {
		await writeFile(
			join(tempDir, "plan.aide"),
			"- [x] Step one\n- [x] Step two\n- [ ] Step three",
		);

		const result = await scan(tempDir);

		expect(result.files[0].summary).toBe("2/3 done");
	});

	it("extracts checkbox summary for todo files", async () => {
		await writeFile(
			join(tempDir, "todo.aide"),
			"- [x] Fix A\n- [ ] Fix B",
		);

		const result = await scan(tempDir);

		expect(result.files[0].summary).toBe("1/2 done");
	});

	it("leaves summary empty for intent files", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			"---\ndescription: Test spec\n---\n# Title\n\nBody text here.",
		);

		const result = await scan(tempDir);

		expect(result.files[0].summary).toBe("");
		expect(result.files[0].description).toBe("Test spec");
	});

	it("scopes to subdirectory when path is provided", async () => {
		await mkdir(join(tempDir, "a"), { recursive: true });
		await mkdir(join(tempDir, "b"), { recursive: true });
		await writeFile(join(tempDir, "a", ".aide"), "A spec");
		await writeFile(join(tempDir, "b", ".aide"), "B spec");

		const result = await scan(tempDir, "a");

		expect(result.files).toHaveLength(1);
		expect(result.files[0].relativePath).toBe("a/.aide");
	});

	it("normalizes paths to POSIX forward slashes", async () => {
		await mkdir(join(tempDir, "deep", "nested"), { recursive: true });
		await writeFile(join(tempDir, "deep", "nested", ".aide"), "Nested spec");

		const result = await scan(tempDir);

		expect(result.files[0].relativePath).toBe("deep/nested/.aide");
		expect(result.files[0].relativePath).not.toContain("\\");
	});

	it("shallow mode skips content reading — summaries are empty", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			"# Title\n\nThis is the first real content line of the spec.",
		);

		const result = await scan(tempDir, undefined, true);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].summary).toBe("");
		expect(result.files[0].type).toBe("intent");
		expect(result.files[0].relativePath).toBe(".aide");
	});

	it("returns empty files array when no .aide files exist", async () => {
		await writeFile(join(tempDir, "readme.md"), "Not an aide file");

		const result = await scan(tempDir);

		expect(result.files).toHaveLength(0);
	});

	it("populates description from frontmatter in deep mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: tools/discover
description: Map-making tool that returns spec locations and ancestor intent chains
intent: Find .aide files.
---

## Context

Body text here.
`,
		);

		const result = await scan(tempDir);

		expect(result.files[0].description).toBe(
			"Map-making tool that returns spec locations and ancestor intent chains",
		);
	});

	it("falls back to first sentence of intent when description is absent in deep mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: tools/discover
intent: Walk the filesystem and collect specs. Return a tree.
---

## Context

Body text here.
`,
		);

		const result = await scan(tempDir);

		expect(result.files[0].description).toBe("Walk the filesystem and collect specs");
	});

	it("leaves description empty when frontmatter has neither description nor intent", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: tools/discover
---

## Context

Body text here.
`,
		);

		const result = await scan(tempDir);

		expect(result.files[0].description).toBe("");
	});

	it("shallow mode reads only the head of a large file, never the whole file", async () => {
		const head = "---\nscope: big\ndescription: Head description\n---\n";
		// A tail that would change the result if it were read: a second description line.
		const tail = "\ndescription: Tail description\n";
		await writeFile(join(tempDir, ".aide"), head + "x".repeat(2_000_000) + tail);
		vi.mocked(fsPromises.readFile).mockClear();

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].description).toBe("Head description");
		expect(fsPromises.readFile).not.toHaveBeenCalled();
	});

	it("shallow mode cuts a multi-byte head at 500 characters like a full read would", async () => {
		const prefix = "---\nscope: m\ndescription: ";
		await writeFile(join(tempDir, ".aide"), prefix + "\u00e9".repeat(600) + "\n---\n");

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].description).toBe("\u00e9".repeat(500 - prefix.length));
	});

	it("populates description from frontmatter in shallow mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: cli
description: Terminal TUI for browsing the .aide intent tree
intent: >
  Give developers a terminal-native way to explore.
---

## Context

Body text here.
`,
		);

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].summary).toBe("");
		expect(result.files[0].description).toBe("Terminal TUI for browsing the .aide intent tree");
	});

	it("falls back to first sentence of intent when description is absent in shallow mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: cli
intent: Give developers a terminal view. More detail here.
---

## Context

Body text here.
`,
		);

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].summary).toBe("");
		expect(result.files[0].description).toBe("Give developers a terminal view");
	});

	it("leaves description empty in shallow mode when frontmatter has neither description nor intent", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: cli
---

## Context

Body text here.
`,
		);

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].summary).toBe("");
		expect(result.files[0].description).toBe("");
	});

	it("extracts description via regex fallback when frontmatter closing --- is beyond 500 bytes", async () => {
		// Build a frontmatter block where the closing `---` does not appear within
		// the first 500 bytes. parseFrontmatter will return null for the sliced head,
		// forcing the extractShallowFields regex path to run.
		const padding = "x".repeat(450);
		const content = `---
description: Fallback description via regex
scope: ${padding}
---

## Body

This is the body text.
`;

		await writeFile(join(tempDir, ".aide"), content);

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].description).toBe("Fallback description via regex");
	});

	describe.each([
		["deep", false],
		["shallow", true],
	])("governed values in %s mode", (_label, shallow) => {
		async function scanOne(name: string, content: string, dir = "") {
			if (dir) await mkdir(join(tempDir, dir), { recursive: true });
			await writeFile(join(tempDir, dir, name), content);
			const result = await scan(tempDir, undefined, shallow);
			return result.files[0];
		}

		it("reads a legacy status: aligned on .aide as alignment: aligned", async () => {
			const file = await scanOne(".aide", "---\nscope: src\ndescription: MCP server root\nstatus: aligned\n---\n");
			expect(file.alignment).toBe("aligned");
			expect(file.workStatus).toBeUndefined();
		});

		it("reads a legacy status: misaligned on .aide as alignment: misaligned", async () => {
			const file = await scanOne(".aide", "---\nscope: src\ndescription: Service modules\nstatus: misaligned\n---\n");
			expect(file.alignment).toBe("misaligned");
		});

		it("reads alignment: unreviewed on .aide", async () => {
			const file = await scanOne(".aide", "---\nscope: src\nalignment: unreviewed\n---\n");
			expect(file.alignment).toBe("unreviewed");
		});

		it("leaves alignment undefined when the spec records none", async () => {
			const file = await scanOne(".aide", "---\nscope: src\ndescription: Some module\n---\n");
			expect(file.alignment).toBeUndefined();
		});

		it("finds alignment after a description that pushes the closing --- past 500 bytes", async () => {
			const longDescription = "x".repeat(300);
			const longIntent = "y".repeat(400);
			const file = await scanOne(".aide", `---\nscope: src\ndescription: ${longDescription}\nalignment: aligned\nintent: ${longIntent}\n---\n`);
			expect(file.alignment).toBe("aligned");
		});

		it("reads plan.aide status: approved as workStatus and never as alignment", async () => {
			const file = await scanOne("plan.aide", "---\nstatus: approved\n---\n- [ ] Step one\n");
			expect(file.workStatus).toBe("approved");
			expect(file.alignment).toBeUndefined();
		});

		it("reads todo.aide status: proposed as workStatus", async () => {
			const file = await scanOne("todo.aide", "---\nstatus: proposed\n---\n- [ ] Fix one\n");
			expect(file.workStatus).toBe("proposed");
			expect(file.alignment).toBeUndefined();
		});

		it("reads no workStatus from the retired status: in-flight", async () => {
			const file = await scanOne("todo.aide", "---\nstatus: in-flight\n---\n- [ ] Fix one\n");
			expect(file.workStatus).toBeUndefined();
			expect(file.alignment).toBeUndefined();
		});

		it("reads neither field from plan.aide status: aligned", async () => {
			const file = await scanOne("plan.aide", "---\nstatus: aligned\n---\n- [ ] Step one\n");
			expect(file.workStatus).toBeUndefined();
			expect(file.alignment).toBeUndefined();
		});

		it("reads neither field from brief.aide status: approved", async () => {
			const file = await scanOne("brief.aide", "---\nstatus: approved\n---\n## Commitments\n");
			expect(file.workStatus).toBeUndefined();
			expect(file.alignment).toBeUndefined();
		});

		it("reads neither field from .aide/session.aide", async () => {
			const file = await scanOne("session.aide", "---\nstatus: approved\nalignment: aligned\n---\n", ".aide");
			expect(file.workStatus).toBeUndefined();
			expect(file.alignment).toBeUndefined();
		});

		it("reads neither field from brain.aide with a status: line", async () => {
			const file = await scanOne("brain.aide", "---\nname: brain\nstatus: aligned\n---\n", ".aide/config");
			expect(file.workStatus).toBeUndefined();
			expect(file.alignment).toBeUndefined();
		});
	});
});
