import { readFile } from "node:fs/promises";
import parseJson from "@/service/observer/event/shared/readObserverRecord/parseJson/index.js";
import isProcessRunning from "@/util/isProcessRunning/index.js";
import { parse, type ObserverRecord } from "@/service/observer/event/shared/observerRecord/index.js";

/**
 * The one reader of `observer.json` in the code base: `record/postToObserver`,
 * and `src/observer`'s running-observer lookup and record removal, all go
 * through it. Returns the record only when the file is readable, parses, fits
 * the schema and its pid is a running process (a dead pid means no observer is
 * running). Anything else is null. It never throws and never writes.
 */
export default async function readObserverRecord({
	observerFile,
}: {
	observerFile: string;
}): Promise<ObserverRecord | null> {
	const content = await readFile(observerFile, "utf-8").catch(() => null);
	if (content === null) return null;

	const json = parseJson(content);
	if (json === undefined) return null;

	const record = parse(json);
	if (record === null) return null;

	// A record left behind by a crashed observer must not count as running.
	if (!isProcessRunning(record.pid)) return null;

	return record;
}
