import listTools from "./listTools/index.js";
import renderToolsSection from "./renderToolsSection/index.js";
import spliceSection from "./spliceSection/index.js";

/**
 * Renders the README with its generated tools section filled in.
 *
 * Reads the shipped tool reference pages through initContent, turns each into
 * one line, and splices those lines between the README's aide-tools markers.
 * Everything outside the markers is returned byte for byte. Pure: it reads the
 * reference pages but writes nothing, so the CLI and the drift test can share it.
 */
export default function renderReadme({ readme }: { readme: string }): string {
	// One entry per tool page, in the tools index order.
	const tools = listTools();

	// One README line per entry.
	const lines = renderToolsSection({ tools });

	// Only the text between the markers changes.
	return spliceSection({ readme, lines });
}
