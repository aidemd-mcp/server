import { readFile } from "node:fs/promises";
import { TOKEN_PATTERN } from "../../shared/tokenFormat/index.js";

/** Reads the stored token; null when the file is missing or holds anything but a well-formed token. */
export default async function readStored({ file }: { file: string }): Promise<string | null> {
	let text: string;
	try {
		text = await readFile(file, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	const stored = text.trim();
	return TOKEN_PATTERN.test(stored) ? stored : null;
}
