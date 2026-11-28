import { listReferencePages, readCanonicalDoc } from "@/service/install/initContent/index.js";
import orderByIndex from "./orderByIndex/index.js";
import readPageFields from "./readPageFields/index.js";

export type ToolEntry = { name: string; description: string };

/**
 * Lists every MCP tool with a reference page, in the tools index page's order.
 *
 * Reads the shipped reference pages through initContent, so the README is built
 * from the same bytes the site and every host project receive.
 */
export default function listTools(): ToolEntry[] {
	// Tool pages are the roster entries under tools/, minus the index page itself.
	const toolPages = listReferencePages().filter(
		({ hostPath }) => hostPath.startsWith("tools/") && hostPath !== "tools/index.md",
	);

	// Each page's frontmatter gives the name and the one-sentence description.
	const tools = toolPages.map(({ canonical, hostPath }) =>
		readPageFields({ hostPath, page: readCanonicalDoc(canonical) }),
	);

	// The index page decides the order and cross-checks that nothing is missing or doubled.
	return orderByIndex({ indexPage: readCanonicalDoc("reference/tools/index"), tools });
}
