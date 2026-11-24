import type { FixtureScenario, FixtureSet } from "@/observer/seedFixtures/types/index.js";
import brainUnreachable from "./brainUnreachable/index.js";
import building from "./building/index.js";
import home from "./home/index.js";
import manyProjects from "./home/manyProjects/index.js";
import idle from "./idle/index.js";
import large from "./large/index.js";
import noEvents from "./noEvents/index.js";
import noRoot from "./noRoot/index.js";
import notInstalled from "./notInstalled/index.js";
import qaFixRound from "./qaFixRound/index.js";
import twoSessions from "./twoSessions/index.js";
import waiting from "./waiting/index.js";

/**
 * The QA scenario catalog of one set. `sessions` is the design handoff's session scenarios, in its order
 * (`s-not-installed` to `s-qa-fix`) with `s-no-folder` last; `home` is the five projects of its Home screen and
 * `home-many` those followed by seven more ended ones. Each scenario is one project with its own folder, board and
 * session logs; the seeder writes them all.
 */
export default function scenarios({ set }: { set: FixtureSet }): FixtureScenario[] {
	if (set === "home") return home();
	if (set === "home-many") return [...home(), ...manyProjects()];

	return [
		notInstalled(),
		noEvents(),
		building(),
		waiting(),
		idle(),
		twoSessions(),
		brainUnreachable(),
		large(),
		qaFixRound(),
		noRoot(),
	];
}
