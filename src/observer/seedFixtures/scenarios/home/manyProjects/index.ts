import { MINUTES_PER_DAY } from "@/util/timeUnits/index.js";
import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import homeProject from "@/observer/seedFixtures/scenarios/shared/homeProject/index.js";
import paddedSession from "@/observer/seedFixtures/scenarios/shared/paddedSession/index.js";

const SESSION_MIN = 30;

/** The handoff's seven extra projects (`home-many`), each with the last activity it gives: 6 h, yesterday, 2, 3, 5 days, 1 and 2 weeks ago. */
const EXTRA: { name: string; id: string; tag: string; lastAgoMin: number }[] = [
	{ name: "billing-worker", id: "billingWorker", tag: "billing", lastAgoMin: 6 * 60 },
	{ name: "search-indexer", id: "searchIndexer", tag: "search", lastAgoMin: MINUTES_PER_DAY },
	{ name: "mobile-shell", id: "mobileShell", tag: "mobile", lastAgoMin: 2 * MINUTES_PER_DAY },
	{ name: "auth-gateway", id: "authGateway", tag: "auth", lastAgoMin: 3 * MINUTES_PER_DAY },
	{ name: "metrics-agent", id: "metricsAgent", tag: "metrics", lastAgoMin: 5 * MINUTES_PER_DAY },
	{ name: "infra-scripts", id: "infraScripts", tag: "infra", lastAgoMin: 7 * MINUTES_PER_DAY },
	{ name: "design-tokens", id: "designTokens", tag: "design", lastAgoMin: 14 * MINUTES_PER_DAY },
];

/** The seven ended projects `home-many` adds after the five of `home`: one 30-minute, 50-event "Housekeeping" session each. */
export default function manyProjects(): FixtureScenario[] {
	return EXTRA.map(({ name, id, tag, lastAgoMin }) => ({
		id,
		label: `home ${name}`,
		project: homeProject({
			folderName: name,
			tag,
			sessions: [
				paddedSession({
					pid: "dead",
					startAgoMin: lastAgoMin + SESSION_MIN,
					durationSec: SESSION_MIN * 60,
					events: 50,
					task: { slug: "housekeeping", title: "Housekeeping" },
				}),
			],
		}),
	}));
}
