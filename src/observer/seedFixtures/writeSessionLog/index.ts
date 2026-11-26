import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import createSessionId from "@/service/observer/event/record/session/createSessionId/index.js";
import { SCHEMA_VERSION, schema } from "@/service/observer/event/shared/schema/index.js";
import create from "@/util/runtimePaths/create/index.js";
import { MINUTE_MS } from "@/util/timeUnits/index.js";
import deadPid from "@/observer/seedFixtures/deadPid/index.js";
import type { FixtureSession } from "@/observer/seedFixtures/types/index.js";

/** What the project reports in its sessions' `session_started`; a field left out is not reported. */
type Reported = { projectRoot?: string; kanbanTag?: string };

/**
 * Writes one fixture session as a JSONL event log in the project's runtime events folder and returns
 * the project key and the new session id. Each line is stamped like the recorder stamps it (`v: 2`,
 * `ts` = `now` minus the event's offset, `sessionId`, `seq` 1..n in array order, `pid`) and checked
 * against the stored-event schema; a line that fails, an offset order that runs forwards in time, or a
 * first event that is not `session_started` throws before anything is written. The session id is the
 * oldest event's time plus six random hex characters, so ids sort by age. `reported` fills the first
 * event's root and tag where the event does not carry its own.
 */
export default async function writeSessionLog({
	projectRoot,
	session,
	now,
	reported = {},
}: {
	projectRoot: string;
	session: FixtureSession;
	now: number;
	reported?: Reported;
}): Promise<{ projectKey: string; sessionId: string }> {
	const [first] = session.events;
	if (first === undefined) throw new Error("A fixture session needs at least one event.");
	if (first.kind !== "session_started") {
		throw new Error(`A fixture session must start with session_started, not ${first.kind}.`);
	}

	const oldest = Math.max(...session.events.map((event) => event.offsetMin));
	const sessionId = createSessionId({ now: new Date(now - oldest * MINUTE_MS) });
	const pid = session.pid === "live" ? process.pid : await deadPid();

	let previousOffset = Number.POSITIVE_INFINITY;
	const lines = session.events.map(({ offsetMin, ...input }, index) => {
		if (offsetMin > previousOffset) {
			throw new Error(`Event ${index + 1} is older than the event before it; offsets must not increase.`);
		}
		previousOffset = offsetMin;

		const fields = index === 0 ? { ...reported, ...input } : input;
		const record = {
			v: SCHEMA_VERSION,
			ts: new Date(now - offsetMin * MINUTE_MS).toISOString(),
			sessionId,
			seq: index + 1,
			pid,
			...fields,
		};

		const checked = schema.safeParse(record);
		if (!checked.success) {
			throw new Error(`Fixture event ${index + 1} (${input.kind}) fails the event schema: ${checked.error.message}`);
		}
		return JSON.stringify(checked.data);
	});

	const paths = await create({ projectRoot });
	await writeFile(join(paths.eventsFolder, `${sessionId}.jsonl`), `${lines.join("\n")}\n`, "utf-8");

	return { projectKey: paths.projectKey, sessionId };
}
