import type { TreeData } from "@/observer/page/types/index.js";

/**
 * The tree's count line: what the project holds (`<n> modules · <m> misaligned · <k> with open work`),
 * plus ` · showing <x>` whenever fewer nodes are drawn than there are modules, whether a filter or a
 * collapsed folder hides them, so the line always says that something is hidden.
 */
export default function buildCountLine({ counts, shown }: { counts: TreeData["counts"]; shown: number }): string {
	const line = `${counts.modules} modules · ${counts.misaligned} misaligned · ${counts.openWork} with open work`;
	return shown < counts.modules ? `${line} · showing ${shown}` : line;
}
