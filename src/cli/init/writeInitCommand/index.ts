import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readCanonicalDoc } from "@/tools/init/initContent/index.js";

export interface WriteInitCommandResult {
	status: "created" | "exists";
	message: string;
}

/**
 * Write the `/aide:init` slash command file to the host project.
 *
 * Target path is `<projectRoot>/.claude/commands/aide/init.md`. Returns
 * `exists` when the file is already present on disk. Otherwise creates the
 * full parent directory tree, reads the canonical content via
 * `readCanonicalDoc`, writes the file, and returns `created`.
 */
export default async function writeInitCommand(
	projectRoot: string,
): Promise<WriteInitCommandResult> {
	const commandPath = join(
		projectRoot,
		".claude",
		"commands",
		"aide",
		"init.md",
	);

	try {
		await access(commandPath);
		return { status: "exists", message: "/aide:init command already present" };
	} catch {
		// ENOENT — file does not exist, proceed to create
	}

	await mkdir(dirname(commandPath), { recursive: true });

	const content = readCanonicalDoc("commands/aide/init");
	await writeFile(commandPath, content, "utf-8");

	return { status: "created", message: "/aide:init command" };
}
