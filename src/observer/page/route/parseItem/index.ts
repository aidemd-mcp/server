import type { DrawerItem } from "@/observer/page/types/index.js";

/** Splits `raw` at its first `:` into the item's kind word and the rest, or null when there is no `:`. */
function splitKind(raw: string): { word: string; rest: string } | null {
	const colon = raw.indexOf(":");
	if (colon === -1) return null;
	return { word: raw.slice(0, colon), rest: raw.slice(colon + 1) };
}

/**
 * Reads a link's `?item=` value into the detail it opens: `module:<folder>` (`.` is the root
 * module), `task:<slug>`, `file:<path>` or `event:<sessionId>:<seq>`, the event split on its
 * last `:` with a positive whole-number seq. Anything else, or an empty target, is null.
 */
export default function parseItem(raw: string | null): DrawerItem | null {
	if (raw === null) return null;
	const split = splitKind(raw);
	if (split === null || split.rest === "") return null;
	const { word, rest } = split;

	if (word === "module") return { kind: "module", folder: rest };
	if (word === "task") return { kind: "task", slug: rest };
	if (word === "file") return { kind: "file", path: rest };
	if (word !== "event") return null;

	const colon = rest.lastIndexOf(":");
	if (colon <= 0) return null;
	const seqText = rest.slice(colon + 1);
	if (!/^[1-9]\d*$/.test(seqText)) return null;
	const seq = Number(seqText);
	if (!Number.isSafeInteger(seq)) return null;
	return { kind: "event", sessionId: rest.slice(0, colon), seq };
}
