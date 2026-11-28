import type { ToolEntry } from "../index.js";

/**
 * Rearranges `tools` into the order the tools index page links them.
 *
 * The index page is the human-facing order and the roster the membership, so a
 * disagreement between them (duplicate link, link with no page, page not linked)
 * throws naming every offender: that is how "every tool exactly once" is
 * enforced rather than hoped for.
 */
export default function orderByIndex({ indexPage, tools }: { indexPage: string; tools: ToolEntry[] }): ToolEntry[] {
	const linked = [...indexPage.matchAll(/\]\(\.\/([^)]+?)\.md\)/g)].map((match) => match[1]);
	const byName = new Map(tools.map((tool) => [tool.name, tool]));

	const duplicates = [...new Set(linked.filter((name, position) => linked.indexOf(name) !== position))];
	if (duplicates.length > 0) {
		throw new Error(`Tools index links more than once: ${duplicates.join(", ")}`);
	}

	const withoutPage = linked.filter((name) => !byName.has(name));
	if (withoutPage.length > 0) {
		throw new Error(`Tools index links a tool with no page: ${withoutPage.join(", ")}`);
	}

	const linkedSet = new Set(linked);
	const missingFromIndex = tools.filter((tool) => !linkedSet.has(tool.name)).map((tool) => tool.name);
	if (missingFromIndex.length > 0) {
		throw new Error(`Tools index does not link: ${missingFromIndex.join(", ")}`);
	}

	return linked.map((name) => byName.get(name)!);
}
