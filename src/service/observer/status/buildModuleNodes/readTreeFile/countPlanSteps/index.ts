import countCheckboxes from "@/util/countCheckboxes/index.js";

/** A numbered plan step heading: `### 3.`. */
const STEP_HEADING = /^### \d+\./;

/**
 * Counts a plan's numbered steps (the `### <n>.` headings inside the `## Plan`
 * section) and how many are done: a step is done when its text holds at least
 * one checkbox and none is open. A plan with no numbered headings falls back to
 * the whole file's checkbox counts. Pure.
 */
export default function countPlanSteps(content: string): { done: number; total: number } {
	const lines = content.split(/\r?\n/);

	// Find the `## Plan` section: from its heading to the next `## ` heading.
	const start = lines.findIndex((line) => /^## Plan\s*$/.test(line));
	const sectionEnd = start === -1 ? -1 : lines.findIndex((line, index) => index > start && /^## /.test(line));
	const section = start === -1 ? [] : lines.slice(start + 1, sectionEnd === -1 ? lines.length : sectionEnd);

	// Split the section into steps, each running from its heading to the next `### ` or the section end.
	const steps: string[][] = [];
	for (const line of section) {
		if (STEP_HEADING.test(line)) steps.push([line]);
		else if (/^### /.test(line)) steps.push([]);
		else steps[steps.length - 1]?.push(line);
	}
	const numbered = steps.filter((step) => step.length > 0);

	// No numbered headings: fall back to the whole file's checkbox counts.
	if (numbered.length === 0) {
		const { total, open } = countCheckboxes(content);
		return { done: total - open.length, total };
	}

	// A step is done when it has checkboxes and none are open.
	const done = numbered.filter((step) => {
		const { total, open } = countCheckboxes(step.join("\n"));
		return total > 0 && open.length === 0;
	}).length;
	return { done, total: numbered.length };
}
