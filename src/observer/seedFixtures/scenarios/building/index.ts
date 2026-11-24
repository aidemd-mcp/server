import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import buildingProject from "@/observer/seedFixtures/scenarios/shared/buildingProject/index.js";

/** `s-building`: live, Build step 4 of 9 on `src/tools/score` (plan approved, 3 of 9 steps checked). */
export default function building(): FixtureScenario {
	return {
		id: "building",
		label: "s-building",
		project: buildingProject({ large: false, brain: "present" }),
	};
}
