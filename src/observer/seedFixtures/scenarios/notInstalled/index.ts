import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import lastEventAgoMin from "@/observer/seedFixtures/scenarios/shared/lastEventAgoMin/index.js";

/** `s-not-installed`: the project folder exists with no `.aide/`; its one live session has only recorded its start. */
export default function notInstalled(): FixtureScenario {
	return {
		id: "notInstalled",
		label: "s-not-installed",
		project: {
			folderName: "aidemd-mcp",
			installed: false,
			files: {},
			board: null,
			reportRoot: true,
			sessions: [{ pid: "live", events: [{ offsetMin: lastEventAgoMin, kind: "session_started" }] }],
		},
	};
}
