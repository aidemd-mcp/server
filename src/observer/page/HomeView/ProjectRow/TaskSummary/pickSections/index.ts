/** One section of a task note: its heading, a one-line preview and its markdown. */
export type TaskSection = { heading: string; preview: string; markdown: string };

/** The first line of prose in a section, list markers and inline markup stripped, for its one-line preview. */
function previewOf(markdown: string): string {
	const line = markdown
		.split("\n")
		.map((candidate) => candidate.trim())
		.find((candidate) => candidate !== "" && !candidate.startsWith("```"));
	return (line ?? "").replace(/^([-*+]|\d+[.)])\s+/, "").replace(/^\[( |x|X)\]\s+/, "").replace(/[*`]/g, "");
}

/**
 * A task note split for progressive reading: frontmatter and the `# title` line dropped, then one
 * section per `##` heading (text before the first one is `Summary`), each with a one-line preview.
 * Empty sections are left out. Pure.
 */
export default function pickSections(markdown: string): TaskSection[] {
	const body = markdown
		.replace(/\r\n?/g, "\n")
		.replace(/^---\n[\s\S]*?\n---\n?/, "")
		.replace(/^\s*# .*\n?/, "");
	const sections: TaskSection[] = [];
	for (const part of body.split(/^(?=## )/m)) {
		const heading = /^## (.*)$/m.exec(part);
		const text = (heading === null ? part : part.slice(heading.index + heading[0].length)).trim();
		if (text === "") continue;
		sections.push({ heading: heading === null ? "Summary" : (heading[1] ?? "").trim(), preview: previewOf(text), markdown: text });
	}
	return sections;
}
