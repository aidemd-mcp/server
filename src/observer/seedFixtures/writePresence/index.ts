import touchPresence from "@/service/observer/event/touchPresence/index.js";
import writeEndedMark from "@/service/observer/event/shared/writeEndedMark/index.js";
import create from "@/util/runtimePaths/create/index.js";
import { MINUTE_MS } from "@/util/timeUnits/index.js";
import type { HookEventName } from "@/types/index.js";
import type { FixtureSession } from "@/observer/seedFixtures/types/index.js";

/** The hook each presence state is recorded from, as the production hooks map them. */
const HOOK_OF_STATE: Record<NonNullable<FixtureSession["presence"]>["state"], HookEventName> = {
	working: "PostToolUse",
	waiting: "Stop",
	ended: "SessionEnd",
};

/**
 * Writes the hook presence and the ended mark of one fixture session in the shape production writes them:
 * the presence through `touchPresence` (a fixture Claude id, linked to the observer session, `now` minus
 * `minutesAgo`, never ending the observer session itself) and the mark through `writeEndedMark` (stamped at
 * the session's last event, `endedBy: "user"`). A session with neither field writes nothing. The ping inside
 * `touchPresence` finds no observer, because the fixture observer starts after seeding, and says so in its
 * outcome rather than throwing; a failed presence write is the one failure raised here.
 */
export default async function writePresence({
	projectRoot,
	session,
	sessionId,
	now,
}: {
	projectRoot: string;
	session: FixtureSession;
	sessionId: string;
	now: number;
}): Promise<void> {
	if (session.presence !== undefined) {
		const { state, minutesAgo } = session.presence;
		const outcome = await touchPresence({
			projectRoot,
			claudeSessionId: `fixture-${sessionId}`,
			hookEvent: HOOK_OF_STATE[state],
			state,
			at: new Date(now - minutesAgo * MINUTE_MS).toISOString(),
			linkSessionId: sessionId,
			endsObserverSession: false,
		});
		if (outcome.detail !== undefined) throw new Error(`Fixture presence for ${sessionId} failed: ${outcome.detail}`);
	}

	if (session.ended === true) {
		const lastOffsetMin = Math.min(...session.events.map((event) => event.offsetMin));
		const { projectKey } = await create({ projectRoot });
		await writeEndedMark({
			projectKey,
			mark: { v: 1, sessionId, endedAt: new Date(now - lastOffsetMin * MINUTE_MS).toISOString(), endedBy: "user" },
		});
	}
}
