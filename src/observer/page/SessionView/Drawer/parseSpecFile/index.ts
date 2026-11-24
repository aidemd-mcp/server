import parseBody from "@/util/parseBody/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import type { SpecView } from "@/observer/page/types/index.js";

/**
 * Reads an intent spec's text for the drawer: scope, intent, both outcome lists and the body's
 * `##` sections (text before the first heading comes as a section with an empty heading). A file
 * whose frontmatter does not parse, or that has none, is `{ error }` so the drawer can say so
 * instead of showing an empty spec.
 */
export default function parseSpecFile(text: string): SpecView {
	const parsed = parseFrontmatter(text);
	if (parsed.parseError !== undefined) return { error: parsed.parseError };
	if (parsed.frontmatter === null) return { error: "This file has no frontmatter block." };

	const { scope, intent, outcomes } = parsed.frontmatter;
	return {
		scope: scope ?? "",
		intent: (intent ?? "").trim(),
		desired: outcomes?.desired ?? [],
		undesired: outcomes?.undesired ?? [],
		sections: parseBody(parsed.body).map((section) => ({ heading: section.heading, markdown: section.content })),
	};
}
