import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import { getMethodology, getMethodologyMarker } from "@/tools/init/initContent/index.js";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/** Write methodology to the agent config file if not already present. */
export default async function writeMethodology(configPath: string): Promise<InitStepResult> {
	const existing = await safeReadFile(configPath);
	const marker = getMethodologyMarker();

	if (existing.includes(marker)) return { name: "Methodology", status: "exists" };

	const methodology = getMethodology();
	const content = existing ? `${existing}\n\n${methodology}\n` : `${methodology}\n`;

	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, content, "utf-8");
	return { name: "Methodology", status: "created" };
}
