/** A single parsed checklist item from a todo.aide body. */
export interface TodoItem {
	/** The main text of the checklist item (first line only, not continuation lines). */
	text: string;
	/** Whether the item is checked (`- [x]`). */
	done: boolean;
	/**
	 * The Misalignment annotation extracted from a continuation line, if present.
	 * e.g. "implementation-drift" from a line like "  Misalignment: implementation-drift"
	 */
	misalignment?: string;
}

/**
 * Parses the body of a todo.aide file into a structured array of checklist items.
 *
 * Format recognised:
 *   - `- [x] item text`   — completed item
 *   - `- [ ] item text`   — open item
 *   Continuation lines (indented lines that follow a checklist item) are scanned
 *   for a `Misalignment:` annotation. The first such annotation found is attached
 *   to the preceding item. All other continuation lines are ignored.
 *
 * Lines that are not checklist items and not continuations of a checklist item
 * (e.g. `##` headings, blank lines, Retro sections) are ignored.
 */
export default function parseTodoItems(body: string): TodoItem[] {
	const lines = body.split("\n");
	const items: TodoItem[] = [];
	let current: TodoItem | null = null;

	for (const line of lines) {
		const checkboxMatch = line.match(/^- \[(x| )\] (.+)/);
		if (checkboxMatch) {
			// Flush previous item before starting a new one
			if (current) items.push(current);
			current = {
				text: checkboxMatch[2]!.trim(),
				done: checkboxMatch[1] === "x",
			};
			continue;
		}

		// Continuation line — only meaningful after a checklist item
		if (current && line.match(/^\s+/)) {
			const misalignmentMatch = line.match(/\bMisalignment:\s*(.+)/);
			if (misalignmentMatch && !current.misalignment) {
				current.misalignment = misalignmentMatch[1]!.trim();
			}
			continue;
		}

		// Non-item, non-continuation line — flush any pending item
		if (current) {
			items.push(current);
			current = null;
		}
	}

	// Flush the last item if body ended while an item was open
	if (current) items.push(current);

	return items;
}
