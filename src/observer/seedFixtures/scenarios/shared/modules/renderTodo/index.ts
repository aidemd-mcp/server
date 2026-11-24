import type { FixtureModule, FixtureTodo } from "@/observer/seedFixtures/types/index.js";
import SCORE_CONTENT from "@/observer/seedFixtures/scenarios/shared/modules/scoreContent/index.js";

/** Item texts for a module whose todo list the handoff only counts; the n-th item reads the n-th entry, wrapping. */
const GENERIC_ITEMS = [
	"error thrown without a typed code",
	"return type widened to unknown",
	"no test for the empty input",
	"path built with a backslash on Windows",
	"unused import left after the refactor",
	"JSDoc names a field that no longer exists",
];

const GENERIC_RETRO = "Nothing worth promoting to the playbook yet.";

/**
 * Renders a module's `todo.aide`: frontmatter `status`, one `- [ ] <file>:<line> — <text>` line per item
 * (the first `total - open` checked; for `src/tools/score` the handoff's own items, whose first `open` are the
 * unchecked ones) and a `## Retro` (the handoff's two retro lines for `src/tools/score`).
 */
export default function renderTodo({ module, todo }: { module: FixtureModule; todo: FixtureTodo }): string {
	const isScore = module.path === "src/tools/score";
	const folder = module.path === "" ? "." : module.path;

	const items = Array.from({ length: todo.total }, (_, index) => {
		const mark = (isScore ? index >= todo.open : index < todo.total - todo.open) ? "x" : " ";
		const scored = isScore ? SCORE_CONTENT.todoItems[index] : undefined;
		const location = scored?.location ?? `${folder}/index.ts:${12 + index * 17}`;
		const text = scored?.text ?? GENERIC_ITEMS[index % GENERIC_ITEMS.length];
		return `- [${mark}] ${location} — ${text}`;
	});

	return [
		"---",
		`status: ${todo.status}`,
		"---",
		"",
		"## Issues",
		"",
		...items,
		"",
		"## Retro",
		"",
		isScore ? SCORE_CONTENT.retro.map((line) => `- ${line}`).join("\n") : GENERIC_RETRO,
		"",
	].join("\n");
}
