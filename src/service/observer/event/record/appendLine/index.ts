import { appendFile } from "node:fs/promises";
import describeError from "@/util/describeError/index.js";
import create from "@/util/runtimePaths/create/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";
import type { ObserverEvent } from "@/service/observer/event/shared/schema/index.js";

/**
 * Append one event as one JSON line to its session's log file. This is the
 * only place the event module writes a log line. It never throws: recording
 * must never fail the pipeline, so every failure on the way (creating the
 * events folder, resolving the path, appending) comes back as
 * `{ written: false, detail }`, where `detail` is the error's message.
 */
export default async function appendLine({
	projectRoot,
	event,
}: {
	projectRoot: string;
	event: ObserverEvent;
}): Promise<{ written: true } | { written: false; detail: string }> {
	try {
		// Make the events folder when it is missing (writes nothing else).
		await create({ projectRoot });

		// Resolve this session's file; a bad session id throws here.
		const path = resolveEventLog({ projectRoot, sessionId: event.sessionId });

		// Append exactly one line.
		await appendFile(path, JSON.stringify(event) + "\n", "utf-8");

		return { written: true };
	} catch (error) {
		return { written: false, detail: describeError({ error }) };
	}
}
