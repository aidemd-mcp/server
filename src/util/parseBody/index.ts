import type { BodySection } from "@/types/index.js";

/** Extract a summary from section content: first sentence, or "N paragraphs" count. */
function summarize(content: string): string {
	const trimmed = content.trim();
	if (!trimmed) return "";

	const firstSentenceMatch = trimmed.match(/^[^.!?]+[.!?]/);
	if (firstSentenceMatch) return firstSentenceMatch[0].trim();

	const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
	if (paragraphs.length === 1) return paragraphs[0].trim().slice(0, 80);
	return `${paragraphs.length} paragraphs`;
}

/**
 * Split a .aide body string into sections by `##` headings.
 * Content before the first heading is collected as an unnamed section (heading: "").
 * Each section's summary is the first sentence or a paragraph count.
 */
export default function parseBody(body: string): BodySection[] {
	const lines = body.split("\n");
	const sections: BodySection[] = [];

	let currentHeading = "";
	let currentLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("## ")) {
			if (currentHeading !== "" || currentLines.some((l) => l.trim())) {
				const content = currentLines.join("\n").trim();
				sections.push({ heading: currentHeading, content, summary: summarize(content) });
			}
			currentHeading = line.slice(3).trim();
			currentLines = [];
		} else {
			currentLines.push(line);
		}
	}

	// Flush the final section.
	if (currentHeading !== "" || currentLines.some((l) => l.trim())) {
		const content = currentLines.join("\n").trim();
		sections.push({ heading: currentHeading, content, summary: summarize(content) });
	}

	return sections;
}
