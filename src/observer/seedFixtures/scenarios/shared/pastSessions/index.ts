import type { FixtureSession } from "@/observer/seedFixtures/types/index.js";
import handoffTasks from "@/observer/seedFixtures/scenarios/shared/handoffTasks/index.js";
import paddedSession from "@/observer/seedFixtures/scenarios/shared/paddedSession/index.js";

/** One ended session of the handoff's session list (`mk(...)`): when it began, how long it ran, how many events it holds, its task. */
type Past = {
	/** Minutes before now the session started. */
	startAgoMin: number;
	/** Seconds between its first and last event. */
	durationSec: number;
	events: number;
	task: { slug: string; title: string };
};

/** The handoff's `m2` … `m4`: Today 09:15 (14:32 is its "now"), Yesterday 16:40 and Yesterday 11:05. */
const SESSIONS: Past[] = [
	{
		startAgoMin: 5 * 60 + 16 + 42 / 60,
		durationSec: 72 * 60,
		events: 186,
		task: handoffTasks.reconnect,
	},
	{
		startAgoMin: 21 * 60 + 51 + 42 / 60,
		durationSec: 48 * 60 + 5,
		events: 97,
		task: handoffTasks.installRoot,
	},
	{
		startAgoMin: 27 * 60 + 26 + 42 / 60,
		durationSec: 22 * 60 + 31,
		events: 41,
		task: handoffTasks.planSubsteps,
	},
];

/**
 * The three ended sessions the handoff lists after the live one (`m2` … `m4`): each starts when the handoff
 * says (measured back from its 14:32 "now"), runs as long as it says and holds as many events as it says. Their
 * pid is dead and each carries an ended mark, so they read as ended.
 */
export default function pastSessions(): FixtureSession[] {
	return SESSIONS.map((past) => paddedSession({ pid: "dead", ...past }));
}
