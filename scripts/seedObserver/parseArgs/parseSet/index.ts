import type { FixtureSet } from "@/observer/seedFixtures/types/index.js";
import refuse from "../../refuse/index.js";

/** Every fixture set, keyed so a set added to or removed from `FixtureSet` fails the type check here. */
const fixtureSets: Record<FixtureSet, true> = { sessions: true, home: true, "home-many": true };
const names = Object.keys(fixtureSets) as FixtureSet[];

/** Reads `--set <name>` (default sessions), refusing a name that is not a fixture set. */
export default function parseSet({ args }: { args: string[] }): FixtureSet {
	const setIndex = args.indexOf("--set");
	if (setIndex === -1) return "sessions";

	const raw = args[setIndex + 1] ?? "";
	const found = names.find((name) => name === raw);
	if (found === undefined)
		refuse({ message: `--set must be ${names.slice(0, -1).join(", ")} or ${names.at(-1)} (got "${raw}").`, code: 2 });
	return found;
}
