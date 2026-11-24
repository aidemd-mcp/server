import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import BOARD_COLUMNS from "@/service/observer/kanban/shared/columns/index.js";
import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";

/** The note text of one task: frontmatter (priority, type, tags and `updated` when it has one), then the markdown body whose first heading is the title. */
function renderNote(task: FixtureTask): string {
	const frontmatter = [
		"---",
		`priority: ${task.priority}`,
		`type: ${task.type}`,
		"tags: []",
		...(task.updated === undefined ? [] : [`updated: "${task.updated}"`]),
		"---",
	].join("\n");
	return `${frontmatter}\n${task.markdown ?? `# ${task.title}`}\n`;
}

/**
 * Writes a board under the brain: `<brainPath>/kanban/<kanbanTag>/<column>/<slug>.md` for each task,
 * with all five column folders created so an empty column still reads as a column.
 */
export default async function writeBoard({
	brainPath,
	kanbanTag,
	tasks,
}: {
	brainPath: string;
	kanbanTag: string;
	tasks: FixtureTask[];
}): Promise<void> {
	const boardFolder = join(brainPath, "kanban", kanbanTag);

	for (const column of BOARD_COLUMNS) {
		await mkdir(join(boardFolder, column.id), { recursive: true });
	}

	for (const task of tasks) {
		await writeFile(join(boardFolder, task.column, `${task.slug}.md`), renderNote(task), "utf-8");
	}
}
