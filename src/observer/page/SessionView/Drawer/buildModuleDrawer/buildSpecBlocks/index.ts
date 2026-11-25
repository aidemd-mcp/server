import type { DrawerBlockModel } from "@/observer/page/types/index.js";
import parseSpecFile from "@/observer/page/SessionView/Drawer/parseSpecFile/index.js";

/**
 * The blocks of an intent spec: its frontmatter (intent, desired and undesired outcomes, each only
 * when the spec has it) and its body (each `## ` section as one paragraph led by its heading). A
 * spec that does not parse is one block with the parser's message, so the drawer says why.
 */
export default function buildSpecBlocks({ text }: { text: string }): DrawerBlockModel[] {
	const spec = parseSpecFile(text);
	if ("error" in spec) return [{ heading: "Spec frontmatter", icon: "doc", badge: null, type: "pre", text: spec.error }];

	const rows: Extract<DrawerBlockModel, { type: "fm" }>["rows"] = [];
	if (spec.intent !== "") rows.push({ key: "intent", value: spec.intent, list: null });
	if (spec.desired.length > 0) rows.push({ key: "desired", value: "", list: spec.desired });
	if (spec.undesired.length > 0) rows.push({ key: "undesired", value: "", list: spec.undesired });

	const paras = spec.sections
		.filter((section) => section.heading !== "" && section.markdown.trim() !== "")
		.map((section) => `${section.heading} — ${section.markdown.replace(/\s+/g, " ").trim()}`);

	const blocks: DrawerBlockModel[] = [];
	if (rows.length > 0) blocks.push({ heading: "Frontmatter", icon: "doc", badge: null, type: "fm", rows });
	if (paras.length > 0) blocks.push({ heading: "Body sections", icon: "list", badge: null, type: "text", paras });
	return blocks;
}
