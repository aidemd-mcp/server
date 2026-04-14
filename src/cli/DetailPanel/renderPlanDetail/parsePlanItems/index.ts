/** A single checklist item within a plan step. */
export interface PlanItem {
	text: string;
	done: boolean;
}

/** A plan step grouping with its heading label and checklist items. */
export interface PlanStep {
	step: string;
	done: boolean;
	items: PlanItem[];
}

interface InternalStep extends PlanStep {
	/** True when the heading itself carried an explicit `[x]` or `[ ]` marker. */
	_headingCheckbox: boolean;
}

/**
 * Parse a plan file body string into structured step groups with checklist items.
 *
 * Recognises three heading formats found in this project's plan files:
 *
 * 1. `### N. [x] Step title`  — numbered with inline checkbox (cli/plan.aide)
 * 2. `### N. Step title`       — numbered without inline checkbox
 * 3. `### Phase N — Title`     — Phase-prefixed with em-dash (init/plan.aide)
 *
 * Checklist items below a heading are lines matching `- [x]` or `- [ ]`.
 * Prose items (non-checklist bullet lines) and all other non-heading lines
 * are ignored. Items that appear before any heading are grouped under an
 * empty-string step.
 *
 * The `done` field on a `PlanStep` is determined as follows:
 * - If the heading carries an inline `[x]`/`[ ]` marker (format 1), that
 *   marker is authoritative — `done` is not overridden by item states.
 * - Otherwise `done` is derived: true when all contained items are done,
 *   false when any item is undone or the step has no items.
 */
export default function parsePlanItems(body: string): PlanStep[] {
	const lines = body.split("\n");
	const steps: InternalStep[] = [];
	let current: InternalStep | null = null;

	for (const raw of lines) {
		const line = raw.trim();

		// Format 1: ### N. [x] Step title  (inline checkbox in heading)
		const inlineCheckHeading = line.match(/^###\s+\d+\.\s+\[(x| )\]\s+(.+)$/i);
		if (inlineCheckHeading) {
			current = {
				step: inlineCheckHeading[2].trim(),
				done: inlineCheckHeading[1].toLowerCase() === "x",
				items: [],
				_headingCheckbox: true,
			};
			steps.push(current);
			continue;
		}

		// Format 2: ### N. Step title  (no inline checkbox)
		const numberedHeading = line.match(/^###\s+\d+\.\s+(.+)$/);
		if (numberedHeading) {
			current = { step: numberedHeading[1].trim(), done: false, items: [], _headingCheckbox: false };
			steps.push(current);
			continue;
		}

		// Format 3: ### Phase N — Title  (Phase prefix with em-dash, en-dash, or hyphen)
		const phaseHeading = line.match(/^###\s+Phase\s+\d+\s+[—–-]+\s+(.+)$/i);
		if (phaseHeading) {
			current = { step: phaseHeading[1].trim(), done: false, items: [], _headingCheckbox: false };
			steps.push(current);
			continue;
		}

		const checkedMatch = line.match(/^-\s+\[x\]\s+(.+)$/i);
		if (checkedMatch) {
			if (!current) {
				current = { step: "", done: false, items: [], _headingCheckbox: false };
				steps.push(current);
			}
			current.items.push({ text: checkedMatch[1].trim(), done: true });
			continue;
		}

		const uncheckedMatch = line.match(/^-\s+\[ \]\s+(.+)$/);
		if (uncheckedMatch) {
			if (!current) {
				current = { step: "", done: false, items: [], _headingCheckbox: false };
				steps.push(current);
			}
			current.items.push({ text: uncheckedMatch[1].trim(), done: false });
		}
	}

	// Derive done for steps whose heading had no inline checkbox:
	// true only when all items are done and at least one item exists.
	for (const step of steps) {
		if (!step._headingCheckbox && step.items.length > 0) {
			step.done = step.items.every((item) => item.done);
		}
	}

	// Strip the internal field before returning.
	return steps.map(({ _headingCheckbox: _hc, ...rest }) => rest);
}
