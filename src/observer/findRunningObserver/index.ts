import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import readObserverRecord from "@/service/observer/event/shared/readObserverRecord/index.js";
import type { RunningObserver } from "../types/index.js";
import probeIndex from "./probeIndex/index.js";

/**
 * The one answer to "is this user's observer running": the root `observer.json` names a running
 * pid (event's reader returns null otherwise) and `GET /` at the recorded address answers as an
 * observer when sent the recorded token. The returned `version` is the probe's answer, the code
 * actually running, not the record's claim. The `port` is the record's `port`, else the one
 * its `address` names (a record written by an older observer has none; brief commitment #98). Takes no project: one observer serves every project,
 * so a start from any project finds the one that runs. Used by `startObserver`'s single-instance
 * check, `takeOver` and the `aide_observer_start` tool, so they never disagree. Never throws;
 * any failure means "not running".
 */
export default async function findRunningObserver(): Promise<RunningObserver | null> {
	try {
		// Locate the per-user observer.json.
		const { observerFile } = resolveRoot();

		// A missing, unreadable or dead-pid record means no observer.
		const record = await readObserverRecord({ observerFile });
		if (record === null) return null;

		// A live pid that does not answer as an observer is stale (e.g. pid reuse).
		const { address, token, pid } = record;
		const port = record.port ?? Number(new URL(address).port);
		const probed = await probeIndex({ address, token });
		if (probed === null) return null;

		return { address, port, token, pid, version: probed.version };
	} catch {
		return null;
	}
}
