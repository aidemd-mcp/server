import { rename, writeFile } from "node:fs/promises";
import type { ObserverRecord } from "@/types/index.js";

/**
 * Publish `observer.json`: write the record to a temp file next to it with mode 0o600, then
 * rename over the real file, so a reader never sees half a record and other users on the
 * machine cannot read the token.
 */
export default async function writeRecord({
	observerFile,
	record,
}: {
	observerFile: string;
	record: ObserverRecord;
}): Promise<void> {
	const tempFile = `${observerFile}.${record.pid}.tmp`;
	await writeFile(tempFile, JSON.stringify(record), { mode: 0o600 });
	await rename(tempFile, observerFile);
}
