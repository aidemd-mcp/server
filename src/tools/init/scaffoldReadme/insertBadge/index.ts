export const BADGE_LINE =
	"[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://github.com/aidemd-mcp/server)";

export const BADGE_DETECTION = "img.shields.io/badge/AIDE";

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
export default function insertBadge(content: string): string {
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
