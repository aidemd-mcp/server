import type { ToolEntry } from "../listTools/index.js";

/**
 * Turns the tool list into the README's tools section, one bullet per tool: the
 * name linking its aidemd.dev page, an em dash, then the page's description.
 *
 * A list item has no cell syntax, so the description is passed through word for
 * word with no escaping, wrapping or trimming. Lines keep the input order.
 */
export default function renderToolsSection({ tools }: { tools: ToolEntry[] }): string[] {
	return tools.map(({ name, description }) => `- [\`${name}\`](https://aidemd.dev/docs/tools/${name}/) — ${description}`);
}
