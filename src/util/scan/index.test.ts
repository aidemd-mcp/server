import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scan from "./index.js";

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

	it("populates status from frontmatter in deep mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: src
description: MCP server root
status: aligned
---
`,
		);

		const result = await scan(tempDir);

		expect(result.files[0].status).toBe("aligned");
	});

	it("populates status: misaligned from frontmatter in deep mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: src/service
description: Service modules
status: misaligned
---
`,
		);

		const result = await scan(tempDir);

		expect(result.files[0].status).toBe("misaligned");
	});

	it("leaves status undefined when frontmatter has no status field", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: src
description: Some module
---
`,
		);

		const result = await scan(tempDir);

		expect(result.files[0].status).toBeUndefined();
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

	it("populates status from frontmatter in shallow mode", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			`---
scope: src
description: MCP server root
status: aligned
---
`,
		);

		const result = await scan(tempDir, undefined, true);

		expect(result.files[0].status).toBe("aligned");
	});
});
