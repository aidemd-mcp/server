import { readFile } from "node:fs/promises";
import { join } from "node:path";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import parseBody from "@/util/parseBody/index.js";
import type { SessionRecord } from "../types/index.js";

type PresentRecord = Extract<SessionRecord, { state: "present" }>;

/** Split a section's markdown at its `### ` headings into the text before the first one and the subsections. */
function splitSubsections(content: string): { markdown: string; subsections: PresentRecord["sections"][number]["subsections"] } {
	const leading: string[] = [];
	const subsections: { heading: string; lines: string[] }[] = [];

	for (const line of content.split("\n")) {
		if (line.startsWith("### ")) {
			subsections.push({ heading: line.slice(4).trim(), lines: [] });
		} else if (subsections.length > 0) {
			subsections[subsections.length - 1].lines.push(line);
		} else {
			leading.push(line);
		}
	}

	return {
		markdown: leading.join("\n").trim(),
		subsections: subsections.map((s) => ({ heading: s.heading, markdown: s.lines.join("\n").trim() })),
	};
}

/**
 * Read `.aide/session.aide` as raw markdown sections for the page to render.
 * A missing file is `missing`; any other read failure or broken frontmatter is `unreadable`.
 * Empty sections are kept with empty markdown. Read-only.
 */
export default async function readSessionRecord({ projectRoot }: { projectRoot: string }): Promise<SessionRecord> {
	// Read the file; ENOENT is "missing", any other failure is "unreadable" with the code.
	let raw: string;
	try {
		raw = await readFile(join(projectRoot, ".aide", "session.aide"), "utf-8");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOENT") return { state: "missing" };
		return { state: "unreadable", error: code ?? (err instanceof Error ? err.message : String(err)) };
	}

	// Parse the frontmatter; a YAML error makes the record unreadable.
	const { frontmatter, body, parseError } = parseFrontmatter(raw.replace(/\r\n/g, "\n"));
	if (parseError) return { state: "unreadable", error: parseError };

	// Split the body: the unnamed leading section is the preamble, each `## ` section keeps its `### ` subsections.
	let preamble = "";
	const sections: PresentRecord["sections"] = [];
	for (const section of parseBody(body)) {
		if (section.heading === "") {
			preamble = section.content;
			continue;
		}
		const { markdown, subsections } = splitSubsections(section.content);
		sections.push({ heading: section.heading, markdown, subsections });
	}

	return { state: "present", intent: frontmatter?.intent?.trim() ?? "", preamble, sections };
}
