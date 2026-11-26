import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import buildingProject from "@/observer/seedFixtures/scenarios/shared/buildingProject/index.js";

/** `s-board-error`: the live build, whose board's kanban folder does not exist. */
export default function brainUnreachable(): FixtureScenario {
	return {
		id: "brainUnreachable",
		label: "s-board-error",
		project: buildingProject({ large: false, brain: "missing", folderName: "ledger-api" }),
	};
}
