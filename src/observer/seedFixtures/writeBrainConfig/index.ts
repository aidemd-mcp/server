import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Writes the fixture project's brain config, `<projectRoot>/.aide/config/brain.aide`: frontmatter only
 * (a name, a launcher whose one argument is `brainPath`, and the `kanban` field declaring the board's
 * folder at `kanbanFolder`), no body. It is the fixture's board location, read by the kanban reader as a
 * frontmatter-only config (it parses as `missing-sections`, which carries the field). The two paths are
 * JSON-quoted so Windows backslashes survive YAML.
 */
export default async function writeBrainConfig({
	projectRoot,
	brainPath,
	kanbanFolder,
}: {
	projectRoot: string;
	brainPath: string;
	kanbanFolder: string;
}): Promise<void> {
	const configFolder = join(projectRoot, ".aide", "config");
	const frontmatter = [
		"---",
		"name: fixture",
		"mcpServerConfig:",
		"  command: mcpvault",
		"  args:",
		`    - ${JSON.stringify(brainPath)}`,
		"kanban:",
		"  source: folder",
		`  path: ${JSON.stringify(kanbanFolder)}`,
		"---",
	].join("\n");

	await mkdir(configFolder, { recursive: true });
	await writeFile(join(configFolder, "brain.aide"), `${frontmatter}\n`, "utf-8");
}
