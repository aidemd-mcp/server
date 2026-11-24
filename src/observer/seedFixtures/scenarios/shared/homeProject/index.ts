import type { FixtureModule, FixtureProject, FixtureSession, FixtureTask } from "@/observer/seedFixtures/types/index.js";
import renderIntent from "@/observer/seedFixtures/scenarios/shared/modules/renderIntent/index.js";
import renderPlan from "@/observer/seedFixtures/scenarios/shared/modules/renderPlan/index.js";
import task from "@/observer/seedFixtures/scenarios/shared/tasks/task/index.js";

/** The module a Home project's running or waiting work names: one folder with a generic spec. */
function moduleOf(path: string): FixtureModule {
	return { path, desc: "The module this project's current work is on", alignment: "aligned" };
}

/** One board task per task a session picked: In Progress while its session's process is alive, else Done. */
function sessionTasks(sessions: FixtureSession[]): FixtureTask[] {
	return sessions.flatMap(({ pid, events }) =>
		events.flatMap((event) =>
			event.kind === "task" && event.action === "picked"
				? [task({ column: pid === "live" ? "in-progress" : "done", slug: event.slug, title: event.title ?? event.slug, priority: "p2", type: "feature" })]
				: [],
		),
	);
}

/**
 * A minimal installed project for a Home scenario set: the root intent spec, the one module its work names
 * (when `module` is given; with `waiting` its `plan.aide` is `proposed`, the file the open approval gate
 * names), a board under its kanban tag holding the task each session picked, and the given sessions.
 */
export default function homeProject({
	folderName,
	tag,
	sessions,
	module,
	waiting = false,
}: {
	folderName: string;
	tag: string;
	sessions: FixtureSession[];
	module?: string;
	waiting?: boolean;
}): FixtureProject {
	const files: Record<string, string> = {
		".aide/intent.aide": renderIntent({ module: { path: "", desc: `${folderName} — a project on this machine`, alignment: "aligned" } }),
	};

	if (module !== undefined) {
		files[`${module}/.aide`] = renderIntent({ module: moduleOf(module) });
		if (waiting) {
			files[`${module}/plan.aide`] = renderPlan({ module: moduleOf(module), plan: { status: "proposed", done: 0, total: 9 } });
		}
	}

	return {
		folderName,
		installed: true,
		files,
		board: { kanbanTag: tag, tasks: sessionTasks(sessions) },
		reportRoot: true,
		sessions,
	};
}
