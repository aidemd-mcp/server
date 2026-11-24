import type { ChecklistItem } from "@/observer/page/types/index.js";
import CHECKBOX_PATTERN from "@/util/checkboxPattern/index.js";
import sameText from "./sameText/index.js";

/** A numbered step heading inside the plan: `### 3. Title`. */
const STEP_HEADING = /^### (\d+)\. (.*)$/;

/** A leading step number on a checkbox's text: `3.` or `2a.`. */
const LEADING_NUMBER = /^(\d+)([a-z]?)\.\s+(.*)$/;

/**
 * Reads a plan's text into checklist rows. A plan in the observer's format has numbered `### N.`
 * step headings with checkboxes beneath them: each heading is one row (done when it holds checkboxes
 * and none is open, the same rule the observer counts steps by) and its checkboxes follow as `sub`
 * rows, except a checkbox that only repeats its heading's text, which folds into the heading row
 * (one row per step) while still counting toward it. A plan without those headings lists its checkbox lines, taking an optional leading `N.` or
 * `Na.` as the number and marking indented or lettered items `sub`. Pure.
 */
export default function parsePlanSteps(text: string): ChecklistItem[] {
	const lines = text.split(/\r?\n/);
	const headed = lines.some((line) => STEP_HEADING.test(line));
	const items: ChecklistItem[] = [];
	let step: ChecklistItem | null = null;
	let boxes = 0;
	let open = 0;

	const close = () => {
		if (step) step.done = boxes > 0 && open === 0;
		step = null;
		boxes = 0;
		open = 0;
	};

	for (const line of lines) {
		if (headed) {
			const heading = line.match(STEP_HEADING);
			if (heading) {
				close();
				step = { number: heading[1]!, text: heading[2]!.trim(), loc: null, done: false, sub: false };
				items.push(step);
				continue;
			}
			if (/^#{1,3} /.test(line)) {
				close();
				continue;
			}
		}
		const box = CHECKBOX_PATTERN.exec(line);
		if (!box) continue;
		const done = box[1] !== " ";
		const body = box[2]!.trim();
		if (headed) {
			if (!step) continue;
			boxes += 1;
			if (!done) open += 1;
			const numbered = body.match(LEADING_NUMBER);
			const text = (numbered ? numbered[3]! : body).trim();
			if (!numbered && sameText(text, step.text)) continue;
			items.push({ number: numbered ? numbered[1]! + numbered[2]! : null, text, loc: null, done, sub: true });
			continue;
		}
		const numbered = body.match(LEADING_NUMBER);
		items.push({
			number: numbered ? numbered[1]! + numbered[2]! : null,
			text: (numbered ? numbered[3]! : body).trim(),
			loc: null,
			done,
			sub: /^\s/.test(line) || (numbered !== null && numbered[2] !== ""),
		});
	}
	close();
	return items;
}
