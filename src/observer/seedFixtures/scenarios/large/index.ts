import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import buildingProject from "@/observer/seedFixtures/scenarios/shared/buildingProject/index.js";

/** `s-large`: the live build in a large project: the handoff's 47 modules and 128 Done tasks. */
export default function large(): FixtureScenario {
	return {
		id: "large",
		label: "s-large",
		project: buildingProject({ large: true, brain: "present", folderName: "platform-monorepo" }),
	};
}
