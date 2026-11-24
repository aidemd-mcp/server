import CHECKBOX_PATTERN from "@/util/checkboxPattern/index.js";
import type { ChecklistItem } from "@/observer/page/types/index.js";

/** The separator between a todo item's location and what is wrong. */
const SEPARATOR = " — ";

/**
 * Reads a todo's text into checklist rows and its retro. Each checkbox line outside the `## Retro`
 * section is one item: `loc` is the text before the first ` — ` (without its bold markers) and
 * `text` what follows; a line with no ` — ` has no `loc`. The retro is the `## Retro` section's
 * markdown, or null when the section is missing or empty. Pure.
 */
export default function parseTodoItems(text: string): { items: ChecklistItem[]; retro: string | null } {
	const items: ChecklistItem[] = [];
	const retro: string[] = [];
	let inRetro = false;
	let sawRetro = false;

	for (const line of text.split(/\r?\n/)) {
		if (/^## /.test(line)) {
			inRetro = /^## Retro\s*$/.test(line);
			sawRetro = sawRetro || inRetro;
			continue;
		}
		if (inRetro) {
			retro.push(line);
			continue;
		}
		const box = CHECKBOX_PATTERN.exec(line);
		if (!box) continue;
		const body = box[2]!.trim();
		const cut = body.indexOf(SEPARATOR);
		items.push({
			number: null,
			loc: cut === -1 ? null : body.slice(0, cut).replace(/^\*\*(.*)\*\*$/, "$1").trim(),
			text: (cut === -1 ? body : body.slice(cut + SEPARATOR.length)).trim(),
			done: box[1] !== " ",
			sub: false,
		});
	}

	const markdown = retro.join("\n").trim();
	return { items, retro: sawRetro && markdown !== "" ? markdown : null };
}
