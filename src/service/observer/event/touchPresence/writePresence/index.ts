import { randomBytes } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";

/**
 * Replaces one presence file whole and atomically (brief commitment #72):
 * the record goes to a temp file beside it, then a rename puts it over `path`,
 * so a reader sees the old record or the new one, never half of either. A
 * failed write or rename removes the temp file and rethrows; the folder must
 * already exist (callers ran `create`).
 */
export default async function writePresence({ path, presence }: { path: string; presence: Presence }): Promise<void> {
	const temp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;

	try {
		await writeFile(temp, JSON.stringify(presence) + "\n", "utf-8");
		await rename(temp, path);
	} catch (error) {
		await rm(temp, { force: true }).catch(() => undefined);
		throw error;
	}
}
