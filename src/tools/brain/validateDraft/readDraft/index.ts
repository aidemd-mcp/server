import { readFile } from "node:fs/promises";

/** The outcome of reading a draft file: its bytes, nothing there, or a fault worded for the draft's path. */
export type DraftRead =
	| { kind: "read"; content: string }
	| { kind: "absent" }
	| { kind: "unreadable"; reason: string };

/**
 * Reads a draft file as UTF-8, verbatim. A missing file is `absent`; any other
 * failure is `unreadable` with a reason that names the draft's project-relative
 * path (not the host config's). Never throws and never writes.
 */
export default async function readDraft({
	absolutePath,
	relativePath,
}: {
	absolutePath: string;
	relativePath: string;
}): Promise<DraftRead> {
	try {
		return { kind: "read", content: await readFile(absolutePath, "utf8") };
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOENT") return { kind: "absent" };
		if (code) return { kind: "unreadable", reason: `cannot read ${relativePath} (${code})` };
		return { kind: "unreadable", reason: `cannot read ${relativePath}: ${String(err)}` };
	}
}
