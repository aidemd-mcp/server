import type { OpenSession } from "../../types/index.js";

/**
 * One line of the HALT (brief commitment #97): who is open, what it is doing, how long it has
 * been quiet, and where it is in its pipeline. `active` when 0 minutes quiet; `maybe stuck` when
 * the liveness says so.
 */
export default function describeOpenSession({ id, idKind, liveness, pipeline, phase }: OpenSession): string {
	const name = idKind === "claude" ? `claude:${id}` : id;
	const state = liveness.state === "waiting" ? "waiting on the user" : "working";
	const quiet =
		liveness.quietMinutes === 0
			? "active"
			: `quiet ${liveness.quietMinutes} min${liveness.maybeStuck ? ", maybe stuck" : ""}`;
	return `- ${name} · ${state} · ${quiet} · last activity ${liveness.lastActivityAt ?? "unknown"} · pipeline ${pipeline ?? "none"} · phase ${phase ?? "none"}`;
}
