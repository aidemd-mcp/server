import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import scenarios from "./scenarios/index.js";
import writeBoard from "./writeBoard/index.js";
import writeProjectFiles from "./writeProjectFiles/index.js";
import writeSessionLog from "./writeSessionLog/index.js";
import type { FixtureSet, SeededFixtures } from "./types/index.js";

/**
 * Seeds every fixture scenario of the given set for the QA observer: per scenario a project folder under
 * `<workDir>/<id>/`, its files when installed, its board under `<workDir>/<id>/brain` (or a brain
 * folder that is never created), and one event log per session in the app-data root. Writes only
 * under `workDir` and the app-data root the caller put in the environment, and throws before writing
 * anything when that root is not `appDataRoot`, so a mis-set environment can never seed the user's own
 * folder. Never starts an observer.
 */
export default async function seedFixtures({
	appDataRoot,
	workDir,
	now,
	set,
}: {
	appDataRoot: string;
	workDir: string;
	now: number;
	set: FixtureSet;
}): Promise<SeededFixtures> {
	const { root } = resolveRoot();
	if (root !== appDataRoot) {
		throw new Error(`The environment resolves the app-data root to "${root}", not "${appDataRoot}"; refusing to seed.`);
	}

	const seeded: SeededFixtures = { scenarios: [] };

	for (const { id, label, project } of scenarios({ set })) {
		const scenarioFolder = join(workDir, id);
		const projectRoot = join(scenarioFolder, project.folderName);
		const brainPath = join(scenarioFolder, "brain");

		await mkdir(projectRoot, { recursive: true });
		if (project.installed) await writeProjectFiles({ projectRoot, files: project.files });

		// A missing-brain board reports a brain folder that is never created.
		if (project.board !== null && "tasks" in project.board) {
			await writeBoard({ brainPath, kanbanTag: project.board.kanbanTag, tasks: project.board.tasks });
		}

		const reported = {
			...(project.reportRoot ? { projectRoot } : {}),
			...(project.board !== null ? { kanbanTag: project.board.kanbanTag, brainPath } : {}),
		};

		const written = await Promise.all(
			project.sessions.map((session) => writeSessionLog({ projectRoot, session, now, reported })),
		);
		// Every session of one project root shares its key; a project with no sessions has none to report.
		const projectKey = written[0]?.projectKey ?? "";
		const sessionIds = written.map(({ sessionId }) => sessionId);

		seeded.scenarios.push({ id, label, projectKey, sessionIds, projectRoot });
	}

	return seeded;
}
