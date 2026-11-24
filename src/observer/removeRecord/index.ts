import { unlink } from "node:fs/promises";
import readObserverRecord from "@/service/observer/event/shared/readObserverRecord/index.js";

/**
 * Remove `observer.json` on stop, but only when it still names this process's pid and token,
 * so a stopping observer never deletes the record of another observer that replaced it.
 * No record, or a file that vanished first, is not an error.
 */
export default async function removeRecord({
	observerFile,
	pid,
	token,
}: {
	observerFile: string;
	pid: number;
	token: string;
}): Promise<void> {
	const record = await readObserverRecord({ observerFile });
	if (record === null) return;
	if (record.pid !== pid || record.token !== token) return;

	try {
		await unlink(observerFile);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
}
