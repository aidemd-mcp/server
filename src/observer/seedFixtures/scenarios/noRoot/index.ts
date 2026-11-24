import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import lastEventAgoMin from "@/observer/seedFixtures/scenarios/shared/lastEventAgoMin/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/**
 * `s-no-folder`: a project whose one live session reported no root (brief #38), so the observer has no folder
 * to read; the page labels the Build running from the session's events alone.
 */
export default function noRoot(): FixtureScenario {
	return {
		id: "noRoot",
		label: "s-no-folder",
		project: {
			folderName: "aidemd-mcp",
			installed: false,
			files: {},
			board: null,
			reportRoot: false,
			sessions: [{ pid: "live", events: timeline({ through: "build", lastAgoMin: lastEventAgoMin }) }],
		},
	};
}
