import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import injectBadge from "./index.js";

const BADGE_DETECTION = "img.shields.io/badge/AIDE";
const BADGE_LINE =
	"[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://github.com/aidemd-mcp/server)";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-inject-badge-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Write content to README.md in the temp project root. */
async function writeReadme(content: string): Promise<string> {
	const readmePath = join(tempDir, "README.md");
	await writeFile(readmePath, content, "utf-8");
	return readmePath;
}

/** Build a README that begins with a YAML frontmatter block. */
function withFrontmatter(body: string): string {
	return `---\ntitle: My Project\n---\n\n${body}`;
}

/** Build a README that begins with a two-badge strip followed by a blank line and a heading. */
function withBadgeStrip(body: string): string {
	return `[![CI](https://github.com/foo/bar/actions/workflows/ci.yml/badge.svg)](...)\n[![Coverage](https://codecov.io/gh/foo/bar/badge.svg)](...)\n\n${body}`;
}

describe("injectBadge", () => {
	describe("README does not exist", () => {
		it("returns would-skip status", async () => {
			const result = await injectBadge(tempDir);

			expect(result.status).toBe("would-skip");
		});

		it("returns empty filePath", async () => {
			const result = await injectBadge(tempDir);

			expect(result.filePath).toBe("");
		});

		it("returns no content field", async () => {
			const result = await injectBadge(tempDir);

			expect(result).not.toHaveProperty("content");
		});

		it("returns category badge and name README badge", async () => {
			const result = await injectBadge(tempDir);

			expect(result.category).toBe("badge");
			expect(result.name).toBe("README badge");
		});
	});

	describe("README already contains the badge", () => {
		it("returns exists status", async () => {
			const readmePath = await writeReadme(
				`${BADGE_LINE}\n\n# My Project\n\nSome description.\n`,
			);

			const result = await injectBadge(tempDir);

			expect(result.status).toBe("exists");
			expect(result.filePath).toBe(readmePath);
		});

		it("returns no content field", async () => {
			await writeReadme(`${BADGE_LINE}\n\n# My Project\n`);

			const result = await injectBadge(tempDir);

			expect(result).not.toHaveProperty("content");
		});

		it("detects badge by URL substring, not full Markdown link", async () => {
			// Modified link text and trailing URL — should still detect as existing
			const altered = `[![AIDE-modified](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat)](https://example.com/changed)`;
			await writeReadme(`${altered}\n\n# My Project\n`);

			const result = await injectBadge(tempDir);

			expect(result.status).toBe("exists");
		});
	});

	describe("README exists, no badges, no frontmatter", () => {
		it("returns would-create status", async () => {
			await writeReadme("# My Project\n\nSome description.\n");

			const result = await injectBadge(tempDir);

			expect(result.status).toBe("would-create");
		});

		it("inserts badge at line 1", async () => {
			await writeReadme("# My Project\n\nSome description.\n");

			const result = await injectBadge(tempDir);

			const lines = result.content!.split("\n");
			expect(lines[0]).toBe(BADGE_LINE);
		});

		it("inserts a blank line between badge and existing content", async () => {
			await writeReadme("# My Project\n\nSome description.\n");

			const result = await injectBadge(tempDir);

			const lines = result.content!.split("\n");
			expect(lines[1]).toBe("");
			expect(lines[2]).toBe("# My Project");
		});

		it("content contains the detection substring", async () => {
			await writeReadme("# My Project\n");

			const result = await injectBadge(tempDir);

			expect(result.content).toContain(BADGE_DETECTION);
		});

		it("filePath points to README.md in the project root", async () => {
			const readmePath = await writeReadme("# My Project\n");

			const result = await injectBadge(tempDir);

			expect(result.filePath).toBe(readmePath);
		});
	});

	describe("README exists with badge strip, no frontmatter", () => {
		it("returns would-create status", async () => {
			await writeReadme(withBadgeStrip("# My Project\n\nSome description.\n"));

			const result = await injectBadge(tempDir);

			expect(result.status).toBe("would-create");
		});

		it("appends badge after the last existing badge line", async () => {
			await writeReadme(withBadgeStrip("# My Project\n\nSome description.\n"));

			const result = await injectBadge(tempDir);
			const lines = result.content!.split("\n");

			// Lines 0 and 1 are the existing badges, line 2 is the AIDE badge
			expect(lines[0]).toContain("[![CI]");
			expect(lines[1]).toContain("[![Coverage]");
			expect(lines[2]).toBe(BADGE_LINE);
		});

		it("preserves blank line between badge strip and heading", async () => {
			await writeReadme(withBadgeStrip("# My Project\n\nSome description.\n"));

			const result = await injectBadge(tempDir);
			const lines = result.content!.split("\n");

			// After the AIDE badge there should be a blank line before the heading
			expect(lines[3]).toBe("");
			expect(lines[4]).toBe("# My Project");
		});

		it("original badges remain on their original lines", async () => {
			await writeReadme(withBadgeStrip("# My Project\n"));

			const result = await injectBadge(tempDir);
			const lines = result.content!.split("\n");

			expect(lines[0]).toContain("github.com/foo/bar");
			expect(lines[1]).toContain("codecov.io");
		});
	});

	describe("README exists with YAML frontmatter, no badges", () => {
		it("returns would-create status", async () => {
			await writeReadme(withFrontmatter("# My Project\n\nSome description.\n"));

			const result = await injectBadge(tempDir);

			expect(result.status).toBe("would-create");
		});

		it("inserts badge after the closing frontmatter fence, not inside it", async () => {
			await writeReadme(withFrontmatter("# My Project\n\nSome description.\n"));

			const result = await injectBadge(tempDir);
			const lines = result.content!.split("\n");

			// Frontmatter is lines 0–2 (---, title: My Project, ---)
			// Line 3 is blank (from withFrontmatter), line 4 should be badge
			expect(lines[0]).toBe("---");
			expect(lines[1]).toBe("title: My Project");
			expect(lines[2]).toBe("---");
		});

		it("does not insert badge before the frontmatter", async () => {
			await writeReadme(withFrontmatter("# My Project\n"));

			const result = await injectBadge(tempDir);
			const lines = result.content!.split("\n");

			expect(lines[0]).toBe("---");
		});

		it("badge appears before the heading, not after it", async () => {
			await writeReadme(withFrontmatter("# My Project\n\nSome description.\n"));

			const result = await injectBadge(tempDir);
			const badgeIndex = result.content!.split("\n").indexOf(BADGE_LINE);
			const headingIndex = result.content!.split("\n").indexOf("# My Project");

			expect(badgeIndex).toBeLessThan(headingIndex);
		});

		it("frontmatter content is unchanged", async () => {
			await writeReadme(withFrontmatter("# My Project\n"));

			const result = await injectBadge(tempDir);

			expect(result.content).toContain("---\ntitle: My Project\n---");
		});
	});

	describe("README exists with YAML frontmatter AND badge strip", () => {
		it("returns would-create status", async () => {
			await writeReadme(withFrontmatter(withBadgeStrip("# My Project\n\nSome description.\n")));

			const result = await injectBadge(tempDir);

			expect(result.status).toBe("would-create");
		});

		it("appends badge after the badge strip, not before frontmatter", async () => {
			await writeReadme(withFrontmatter(withBadgeStrip("# My Project\n")));

			const result = await injectBadge(tempDir);
			const lines = result.content!.split("\n");

			// frontmatter: lines 0-2 (---, title: My Project, ---)
			// blank line: line 3
			// badge strip: lines 4-5
			// AIDE badge: line 6
			expect(lines[0]).toBe("---");
			expect(lines[4]).toContain("[![CI]");
			expect(lines[5]).toContain("[![Coverage]");
			expect(lines[6]).toBe(BADGE_LINE);
		});

		it("frontmatter is untouched", async () => {
			await writeReadme(withFrontmatter(withBadgeStrip("# My Project\n")));

			const result = await injectBadge(tempDir);

			expect(result.content).toContain("---\ntitle: My Project\n---");
		});

		it("existing badges are untouched", async () => {
			await writeReadme(withFrontmatter(withBadgeStrip("# My Project\n")));

			const result = await injectBadge(tempDir);

			expect(result.content).toContain("[![CI](https://github.com/foo/bar");
			expect(result.content).toContain("[![Coverage](https://codecov.io");
		});
	});
});
