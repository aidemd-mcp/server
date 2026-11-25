import type { IconName } from "@/observer/page/types/index.js";

/** The glyph for each drawer kind word, checked in order by the word's start. */
const ICONS: [string, IconName][] = [
	["Module", "folder"],
	["Phase finished", "done"],
	["Phase started", "flag"],
	["Task", "task"],
	["File", "file"],
	["Prompt", "prompt"],
	["Commit", "commit"],
	["Release", "tag"],
	["Error", "error"],
	["QA", "issues"],
	["Session", "power"],
	["Waiting", "wait"],
	["Approved", "gate"],
	["Plan step", "step"],
];

/** The icon the compact Details header shows for a drawer's kind word (`Module`, `Phase finished`, ...); a document for anything else. */
export default function pickKindIcon(kind: string): IconName {
	return ICONS.find(([prefix]) => kind.startsWith(prefix))?.[1] ?? "doc";
}
