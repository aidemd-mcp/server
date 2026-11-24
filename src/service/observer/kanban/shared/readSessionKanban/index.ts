import { join } from "node:path";
import { readFile } from "node:fs/promises";
import parseFrontmatter from "@/util/parseFrontmatter/index.js";
import parseBody from "@/util/parseBody/index.js";

/** The session record's heading that lists the board tasks the session touched. */
const KANBAN_HEADING = "Kanban";

/**
 * Reads the `## Kanban` section of the project's `.aide/session.aide`, the only place the observer
 * learns which board tasks a session names. Returns "" when the record or the section is absent. Read-only.
 */
export default async function readSessionKanban({ projectRoot }: { projectRoot: string }): Promise<string> {
	let raw: string;
	try {
		raw = await readFile(join(projectRoot, ".aide", "session.aide"), "utf-8");
	} catch {
		return "";
	}

	const { body } = parseFrontmatter(raw);
	const section = parseBody(body).find((candidate) => candidate.heading === KANBAN_HEADING);
	return section?.content ?? "";
}
