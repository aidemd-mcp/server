import type { FixtureModule, ScoreWork } from "@/observer/seedFixtures/types/index.js";
import renderIntent from "./renderIntent/index.js";
import renderPlan from "./renderPlan/index.js";
import renderTodo from "./renderTodo/index.js";
import moduleTable from "./table/index.js";

/** The project-relative folder an AIDE file of a module lives in; the root module's files sit inside `.aide/`. */
function folderOf(module: FixtureModule): string {
	return module.path === "" ? ".aide" : module.path;
}

/**
 * Turns the handoff's module list into project files by root-relative path: each module's intent spec
 * (`.aide/intent.aide` for the root, `<path>/.aide` otherwise) and, per its flags, an approved
 * `brief.aide`, a `research.aide`, a `plan.aide` and a `todo.aide`. `src/tools/score` takes its plan and
 * todo from `score` (null leaves the file out), so each scenario sets how far the pipeline has got.
 * `large` adds the handoff's extra modules.
 */
export default function moduleFiles({ large, score }: { large: boolean; score: ScoreWork }): Record<string, string> {
	const files: Record<string, string> = {};

	for (const base of moduleTable({ large })) {
		const isScore = base.path === "src/tools/score";
		const module: FixtureModule = isScore ? { ...base, plan: score.plan ?? undefined, todo: score.todo ?? undefined } : base;
		const folder = folderOf(module);

		files[module.path === "" ? ".aide/intent.aide" : `${folder}/.aide`] = renderIntent({ module });
		if (module.brief) files[`${folder}/brief.aide`] = `---\nstatus: approved\n---\n\n# Brief: ${module.desc}\n`;
		if (module.research) files[`${folder}/research.aide`] = `# Research: ${module.desc}\n`;
		if (module.plan) files[`${folder}/plan.aide`] = renderPlan({ module, plan: module.plan });
		if (module.todo) files[`${folder}/todo.aide`] = renderTodo({ module, todo: module.todo });
	}

	return files;
}
