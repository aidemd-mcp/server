import parsePlanSteps from "@/observer/page/SessionView/Drawer/parsePlanSteps/index.js";

/** The plan's own words for numbered step `step` (its `### N.` heading text), or null when the plan has no such step. */
export default function pickStepText({ text, step }: { text: string; step: number }): string | null {
	return parsePlanSteps(text).find((item) => !item.sub && item.number === String(step))?.text ?? null;
}
