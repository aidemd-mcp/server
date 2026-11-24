import type { FixtureModule } from "@/observer/seedFixtures/types/index.js";
import SCORE_CONTENT from "@/observer/seedFixtures/scenarios/shared/modules/scoreContent/index.js";

/** A generic spec body for a module the handoff gives no spec of its own (it only ever opens `src/tools/score`). */
const GENERIC_OUTCOMES = {
	desired: ["Behaviour matches the parent intent without restating it.", "Failures surface as errors the caller can read."],
	undesired: ["Silent writes outside .aide/ or the brain."],
};

/** A YAML double-quoted scalar; JSON strings are valid YAML, so no value needs escaping by hand. */
function quote(value: string): string {
	return JSON.stringify(value);
}

/**
 * Renders a module's intent spec: frontmatter with scope, alignment, description, intent and its
 * outcomes (the handoff's own spec for `src/tools/score`, a generic one for the rest), then the
 * body sections the handoff shows for that module.
 */
export default function renderIntent({ module }: { module: FixtureModule }): string {
	const isScore = module.path === "src/tools/score";
	const intent = isScore ? SCORE_CONTENT.spec.intent : `${module.desc}.`;
	const outcomes = isScore ? SCORE_CONTENT.spec : GENERIC_OUTCOMES;
	const sections: Record<string, string> = isScore ? SCORE_CONTENT.spec.sections : {};

	const frontmatter = [
		"---",
		`scope: ${quote(module.path === "" ? "." : module.path)}`,
		`alignment: ${module.alignment}`,
		`description: ${quote(module.desc)}`,
		`intent: ${quote(intent)}`,
		"outcomes:",
		"  desired:",
		...outcomes.desired.map((line) => `    - ${quote(line)}`),
		"  undesired:",
		...outcomes.undesired.map((line) => `    - ${quote(line)}`),
		"---",
	].join("\n");

	const body = Object.entries(sections)
		.map(([heading, text]) => `## ${heading}\n\n${text}\n`)
		.join("\n");

	return body === "" ? `${frontmatter}\n` : `${frontmatter}\n\n${body}`;
}
