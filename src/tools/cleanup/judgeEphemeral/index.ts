import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";
import type { CleanupEphemeral, OpenCheckbox } from "@/types/index.js";
import findOpenItems from "../findOpenItems/index.js";

/** What one ephemeral's own recorded status says about its cycle, with the open items the refusal needs to name. */
export type EphemeralVerdict =
	| { verdict: "closed" }
	| { verdict: "open-status"; status: string; items: OpenCheckbox[] }
	| { verdict: "completed-open"; items: OpenCheckbox[] }
	| { verdict: "no-status-empty" }
	| { verdict: "no-status-open"; items: OpenCheckbox[] }
	| { verdict: "invalid-status"; detail: string };

/** Scans a plan, todo or brief for unchecked items, each tagged with its file. */
function scanItems(file: CleanupEphemeral, content: string): { total: number; items: OpenCheckbox[] } {
	const { total, open } = findOpenItems(content);
	return { total, items: open.map(({ line, text }) => ({ file, line, text })) };
}

/**
 * Judges one ephemeral by the status recorded in its own frontmatter, read
 * through aide_frontmatter's reader. Pure: it takes the file's name and text.
 * Plan, todo and brief share one lifecycle: abandoned is closed whatever is
 * open; completed is closed only when no item is open, a brief's included
 * (zero checkboxes counts as none); proposed and approved are open, and a
 * brief's items are not carried into that verdict; a file with no status is
 * closed when it is a brief (its checkboxes are not read), or a plan or todo
 * whose items are all checked and that has at least one. An invalid value
 * or unparsable frontmatter is never closed. The status is only ever read from the file's own frontmatter; the
 * tool never sets one and never treats a file as closed because of its age,
 * emptiness or the caller asking.
 */
export default function judgeEphemeral({
	file,
	content,
}: {
	file: CleanupEphemeral;
	content: string;
}): EphemeralVerdict {
	const kind = file === "plan.aide" ? "plan" : file === "todo.aide" ? "todo" : "brief";
	const read = readGovernedValue({ content, kind });

	if (read.status === "unparsable") {
		return { verdict: "invalid-status", detail: `its frontmatter cannot be parsed (${read.detail})` };
	}
	if (read.current.state === "invalid") {
		return { verdict: "invalid-status", detail: `status "${read.current.raw}" is not a valid status here` };
	}

	const { total, items } = scanItems(file, content);

	if (read.current.state === "set") {
		const status = read.current.value;
		if (status === "abandoned") return { verdict: "closed" };
		if (status === "completed") {
			return items.length === 0 ? { verdict: "closed" } : { verdict: "completed-open", items };
		}
		return { verdict: "open-status", status, items: file === "brief.aide" ? [] : items };
	}

	if (file === "brief.aide") return { verdict: "closed" };
	if (total === 0) return { verdict: "no-status-empty" };
	if (items.length > 0) return { verdict: "no-status-open", items };
	return { verdict: "closed" };
}
