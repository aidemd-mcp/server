import parseBody from "@/util/parseBody/index.js";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import type { DrawerBlockModel } from "@/observer/page/types/index.js";
import buildSectionBlock from "@/observer/page/SessionView/Drawer/buildTaskDrawer/buildSectionBlock/index.js";

/**
 * The blocks of a kanban note: the text before its first `## ` heading (without the `# ` title line)
 * as `Description`, then each `## ` section under its own heading. A section with no text adds none.
 */
export default function buildTaskBlocks({ markdown }: { markdown: string }): DrawerBlockModel[] {
	const sections = parseBody(parseFrontmatter(markdown).body);
	return sections.flatMap((section) => {
		const isLead = section.heading === "";
		const content = isLead ? section.content.split("\n").filter((line) => !/^# /.test(line)).join("\n") : section.content;
		const block = buildSectionBlock({ heading: isLead ? "Description" : section.heading, content });
		return block === null ? [] : [block];
	});
}
