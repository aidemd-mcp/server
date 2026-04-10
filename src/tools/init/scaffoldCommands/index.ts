import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import { getCommands } from "@/tools/init/initContent/index.js";

/** Check if a file exists. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/** Create slash command files, skipping any that already exist. */
export default async function scaffoldCommands(commandDir: string): Promise<InitStepResult[]> {
	const commands = getCommands();
	const results: InitStepResult[] = [];

	await mkdir(commandDir, { recursive: true });

	for (const [filename, content] of Object.entries(commands)) {
		const filePath = join(commandDir, filename);
		const name = filename.replace(".md", "");

		if (await fileExists(filePath)) {
			results.push({ name, status: "exists" });
		} else {
			await writeFile(filePath, content, "utf-8");
			results.push({ name, status: "created" });
		}
	}

	return results;
}
