import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";

const BADGE_LINE =
	"[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://github.com/aidemd-mcp/server)";

const BADGE_DETECTION = "img.shields.io/badge/AIDE";

/** Check if a file exists on disk. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Compute the modified README text with the AIDE badge inserted at the
 * correct vertical position.
 *
 * Phase one: if the file begins with a `---` fence, advance past the closing
 * `---` and any blank line that follows (YAML frontmatter skip).
 * Phase two: starting from the post-frontmatter index, count consecutive
 * lines that begin with `[![` — the existing badge strip. The AIDE badge is
 * inserted immediately after the last badge-strip line. When no strip exists,
 * it is inserted at the post-frontmatter position.
 *
 * A blank line is ensured between the badge (or badge strip) and the
 * content below so the result renders cleanly.
 */
function insertBadge(content: string): string {
	const lines = content.split("\n");
	let insertAt = 0;

	// Phase one: skip YAML frontmatter.
	if (lines[0]?.trim() === "---") {
		let closingIndex = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i]?.trim() === "---") {
				closingIndex = i;
				break;
			}
		}
		if (closingIndex !== -1) {
			insertAt = closingIndex + 1;
			// Skip any trailing blank line after the closing fence.
			if (insertAt < lines.length && lines[insertAt]?.trim() === "") {
				insertAt++;
			}
		}
	}

	// Phase two: count consecutive badge-strip lines starting with `[![`.
	let badgeStripEnd = insertAt;
	while (badgeStripEnd < lines.length && lines[badgeStripEnd]?.startsWith("[![")) {
		badgeStripEnd++;
	}

	// Build the new lines array.
	const before = lines.slice(0, badgeStripEnd);
	const after = lines.slice(badgeStripEnd);

	// Ensure a blank line separates the badge strip from the content below.
	// If there is already a blank line at the start of `after`, preserve it.
	// Otherwise, insert one.
	const hasTrailingBlank = after.length > 0 && after[0]?.trim() === "";
	const separator = hasTrailingBlank ? [] : [""];

	return [...before, BADGE_LINE, ...separator, ...after].join("\n");
}

/**
 * Inspect the host project's README.md and return a planning step for the
 * AIDE shields.io badge.
 *
 * Three-status contract:
 * - `would-skip` — README.md does not exist. The category writes nothing and
 *   the agent reports "no README found".
 * - `exists` — README already contains the detection substring
 *   (`img.shields.io/badge/AIDE`). Nothing to do.
 * - `would-create` — README exists and the badge is absent. The `content`
 *   field holds the full modified README text so `applySteps` can write it
 *   directly.
 *
 * Insertion uses a two-phase scan: (a) skip any YAML frontmatter block
 * (`---` opener through closing `---` plus any trailing blank line), then
 * (b) count consecutive lines beginning with `[![` — the existing badge
 * strip. The AIDE badge is appended after the last badge-strip line, or
 * placed at the post-frontmatter position when no strip exists. A blank line
 * is always preserved between the badge row and the content below.
 */
export default async function injectBadge(projectRoot: string): Promise<InitStep> {
	const readmePath = join(projectRoot, "README.md");

	if (!(await fileExists(readmePath))) {
		return {
			name: "README badge",
			status: "would-skip",
			category: "badge",
			filePath: "",
		};
	}

	const readmeContent = await readFile(readmePath, "utf-8");

	if (readmeContent.includes(BADGE_DETECTION)) {
		return {
			name: "README badge",
			status: "exists",
			category: "badge",
			filePath: readmePath,
		};
	}

	return {
		name: "README badge",
		status: "would-create",
		category: "badge",
		filePath: readmePath,
		content: insertBadge(readmeContent),
	};
}
