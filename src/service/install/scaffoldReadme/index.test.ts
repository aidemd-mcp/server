import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import scaffoldReadme from "./index.js";
import { BADGE_LINE, BADGE_DETECTION } from "./insertBadge/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-scaffold-readme-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 7b-i. No README exists
// ---------------------------------------------------------------------------

describe("scaffoldReadme — no README exists (create path)", () => {
	it("returns would-create status with category readme", async () => {
		const result = await scaffoldReadme(tempDir);

		expect(result.status).toBe("would-create");
		expect(result.category).toBe("readme");
	});

	it("filePath points to README.md in the project root", async () => {
		const result = await scaffoldReadme(tempDir);

		expect(result.filePath).toBe(join(tempDir, "README.md"));
	});

	it("content starts with BADGE_LINE", async () => {
		const result = await scaffoldReadme(tempDir);

		expect(result.content).toBeDefined();
		expect(result.content!.startsWith(BADGE_LINE)).toBe(true);
	});

	it("content contains a heading derived from the folder name", async () => {
		// tempDir ends with a random suffix — create a predictable subfolder
		const projectDir = join(tempDir, "my-cool-project");
		await import("node:fs/promises").then((fs) => fs.mkdir(projectDir));

		const result = await scaffoldReadme(projectDir);

		expect(result.content).toContain("# My Cool Project");
	});

	it("content contains the placeholder description line", async () => {
		const result = await scaffoldReadme(tempDir);

		expect(result.content).toContain("A brief description of what this project does.");
	});

	it("step name is README", async () => {
		const result = await scaffoldReadme(tempDir);

		expect(result.name).toBe("README");
	});

	it("never writes to disk", async () => {
		await scaffoldReadme(tempDir);

		const readmePath = join(tempDir, "README.md");
		await expect(
			import("node:fs/promises").then((fs) => fs.readFile(readmePath, "utf-8")),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 7b-ii. README exists, no badge
// ---------------------------------------------------------------------------

describe("scaffoldReadme — README exists, no badge (inject path)", () => {
	it("returns would-create status with category readme", async () => {
		await writeFile(join(tempDir, "README.md"), "# My Project\n\nSome content.\n", "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.status).toBe("would-create");
		expect(result.category).toBe("readme");
	});

	it("content contains the AIDE badge", async () => {
		await writeFile(join(tempDir, "README.md"), "# My Project\n\nSome content.\n", "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.content).toContain(BADGE_DETECTION);
	});

	it("badge is inserted before the heading, not after it", async () => {
		await writeFile(join(tempDir, "README.md"), "# My Project\n\nSome content.\n", "utf-8");

		const result = await scaffoldReadme(tempDir);

		const badgeIndex = result.content!.indexOf(BADGE_LINE);
		const headingIndex = result.content!.indexOf("# My Project");
		expect(badgeIndex).toBeLessThan(headingIndex);
	});

	it("badge appends to an existing badge strip", async () => {
		const existing = [
			"[![CI](https://github.com/foo/bar/actions/workflows/ci.yml/badge.svg)](https://github.com/foo/bar/actions)",
			"[![Coverage](https://codecov.io/gh/foo/bar/badge.svg)](https://codecov.io/gh/foo/bar)",
			"",
			"# My Project",
			"",
			"Some description here.",
			"",
		].join("\n");
		await writeFile(join(tempDir, "README.md"), existing, "utf-8");

		const result = await scaffoldReadme(tempDir);

		const lines = result.content!.split("\n");
		// The first three lines should be badges (CI, Coverage, AIDE)
		expect(lines[0]).toContain("[![CI]");
		expect(lines[1]).toContain("[![Coverage]");
		expect(lines[2]).toBe(BADGE_LINE);
		// The line after the badge strip should be blank
		expect(lines[3]).toBe("");
	});

	it("step name is README badge", async () => {
		await writeFile(join(tempDir, "README.md"), "# My Project\n", "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.name).toBe("README badge");
	});

	it("filePath points to the existing README.md", async () => {
		await writeFile(join(tempDir, "README.md"), "# My Project\n", "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.filePath).toBe(join(tempDir, "README.md"));
	});

	it("never writes to disk", async () => {
		const originalContent = "# My Project\n\nSome content.\n";
		await writeFile(join(tempDir, "README.md"), originalContent, "utf-8");

		await scaffoldReadme(tempDir);

		const onDisk = await import("node:fs/promises").then((fs) =>
			fs.readFile(join(tempDir, "README.md"), "utf-8"),
		);
		expect(onDisk).toBe(originalContent);
	});
});

// ---------------------------------------------------------------------------
// 7b-iii. README exists, badge already present
// ---------------------------------------------------------------------------

describe("scaffoldReadme — README exists, badge already present (exists path)", () => {
	it("returns exists status", async () => {
		const content = `${BADGE_LINE}\n\n# My Project\n\nSome content.\n`;
		await writeFile(join(tempDir, "README.md"), content, "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.status).toBe("exists");
	});

	it("returns category readme", async () => {
		const content = `${BADGE_LINE}\n\n# My Project\n`;
		await writeFile(join(tempDir, "README.md"), content, "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.category).toBe("readme");
	});

	it("does not return a content field", async () => {
		const content = `${BADGE_LINE}\n\n# My Project\n`;
		await writeFile(join(tempDir, "README.md"), content, "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.content).toBeUndefined();
	});

	it("filePath points to the existing README.md", async () => {
		const content = `${BADGE_LINE}\n\n# My Project\n`;
		await writeFile(join(tempDir, "README.md"), content, "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.filePath).toBe(join(tempDir, "README.md"));
	});

	it("detects badge by URL substring, not full Markdown image-link", async () => {
		// User changed the link target — detection must still fire on the URL substring
		const customLink = `[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://custom-link.com)`;
		const content = `${customLink}\n\n# My Project\n`;
		await writeFile(join(tempDir, "README.md"), content, "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.status).toBe("exists");
	});
});

// ---------------------------------------------------------------------------
// 7b-iv. README with frontmatter and badge strip
// ---------------------------------------------------------------------------

describe("scaffoldReadme — README with YAML frontmatter", () => {
	it("badge is inserted after frontmatter, not before or inside it", async () => {
		const readme = ["---", "title: My Project", "---", "", "# My Project", ""].join("\n");
		await writeFile(join(tempDir, "README.md"), readme, "utf-8");

		const result = await scaffoldReadme(tempDir);

		const lines = result.content!.split("\n");
		// Lines 0–2 must be frontmatter
		expect(lines[0]).toBe("---");
		expect(lines[1]).toBe("title: My Project");
		expect(lines[2]).toBe("---");
		// The badge must not appear before the closing fence
		const badgeIndex = lines.indexOf(BADGE_LINE);
		expect(badgeIndex).toBeGreaterThan(2);
	});

	it("frontmatter content is untouched", async () => {
		const frontmatter = "---\ntitle: My Project\nauthor: Jane\n---\n";
		await writeFile(join(tempDir, "README.md"), frontmatter + "\n# My Project\n", "utf-8");

		const result = await scaffoldReadme(tempDir);

		expect(result.content).toContain("title: My Project");
		expect(result.content).toContain("author: Jane");
	});

	it("badge appends to strip after frontmatter when strip already exists", async () => {
		const readme = [
			"---",
			"title: My Project",
			"---",
			"",
			"[![CI](https://github.com/foo/bar/actions/workflows/ci.yml/badge.svg)](https://github.com/foo/bar/actions)",
			"",
			"# My Project",
			"",
		].join("\n");
		await writeFile(join(tempDir, "README.md"), readme, "utf-8");

		const result = await scaffoldReadme(tempDir);

		const lines = result.content!.split("\n");
		// Find the CI badge line
		const ciIndex = lines.findIndex((l) => l.includes("[![CI]"));
		// AIDE badge must immediately follow the CI badge
		expect(lines[ciIndex + 1]).toBe(BADGE_LINE);
	});
});

// ---------------------------------------------------------------------------
// 7b-v. README with package.json name
// ---------------------------------------------------------------------------

describe("scaffoldReadme — package.json name in generated README", () => {
	it("uses package.json name as the heading when creating a README", async () => {
		await writeFile(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "my-awesome-tool" }),
			"utf-8",
		);

		const result = await scaffoldReadme(tempDir);

		expect(result.content).toContain("# my-awesome-tool");
	});

	it("package.json name takes precedence over folder name", async () => {
		const projectDir = join(tempDir, "folder-based-name");
		await import("node:fs/promises").then((fs) => fs.mkdir(projectDir));
		await writeFile(
			join(projectDir, "package.json"),
			JSON.stringify({ name: "manifest-name" }),
			"utf-8",
		);

		const result = await scaffoldReadme(projectDir);

		expect(result.content).toContain("# manifest-name");
		expect(result.content).not.toContain("Folder Based Name");
	});
});

// ---------------------------------------------------------------------------
// 7b-vi. Idempotency
// ---------------------------------------------------------------------------

describe("scaffoldReadme — idempotency", () => {
	it("returns exists when re-run on a project that already has the badge-bearing README", async () => {
		// Simulate what the create path would produce and write it to disk
		// (as if applySteps had previously written it)
		const { mkdir: mkdirFs } = await import("node:fs/promises");
		const projectDir = join(tempDir, "my-project");
		await mkdirFs(projectDir);

		// First call — plan mode
		const firstResult = await scaffoldReadme(projectDir);
		expect(firstResult.status).toBe("would-create");
		expect(firstResult.content).toBeDefined();

		// Simulate apply: write the content to disk
		await writeFile(join(projectDir, "README.md"), firstResult.content!, "utf-8");

		// Second call — should detect badge and return exists
		const secondResult = await scaffoldReadme(projectDir);
		expect(secondResult.status).toBe("exists");
		expect(secondResult.content).toBeUndefined();
	});

	it("never produces a duplicate badge when re-run after badge injection into an existing README", async () => {
		const originalReadme = "# Existing Project\n\nSome content.\n";
		await writeFile(join(tempDir, "README.md"), originalReadme, "utf-8");

		// First call — inject mode
		const firstResult = await scaffoldReadme(tempDir);
		expect(firstResult.status).toBe("would-create");

		// Simulate apply: write the injected content to disk
		await writeFile(join(tempDir, "README.md"), firstResult.content!, "utf-8");

		// Second call — badge already present, should return exists
		const secondResult = await scaffoldReadme(tempDir);
		expect(secondResult.status).toBe("exists");

		// Verify the final content has only one AIDE badge
		const { readFile } = await import("node:fs/promises");
		const finalContent = await readFile(join(tempDir, "README.md"), "utf-8");
		const badgeCount = (finalContent.match(/img\.shields\.io\/badge\/AIDE/g) ?? []).length;
		expect(badgeCount).toBe(1);
	});
});
