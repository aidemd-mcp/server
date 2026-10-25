import { GOVERNED_FIELDS } from "../governedFields/index.js";
import type { CurrentValue, GovernedKind, WorkStatus } from "../types/index.js";

/** The moves a plan, todo list or brief may make out of each status; completed and abandoned lead nowhere. */
const WORK_MOVES: Record<WorkStatus, readonly WorkStatus[]> = {
	proposed: ["approved", "abandoned"],
	approved: ["completed", "proposed", "abandoned"],
	completed: [],
	abandoned: [],
};

/** The values reachable from one value of a kind, in the kind's value order; an intent spec's alignment may move to any other value. */
function nextValues(kind: GovernedKind, from: string): string[] {
	const { values } = GOVERNED_FIELDS[kind];
	if (kind === "intent-spec") return values.filter((value) => value !== from);
	const moves: readonly string[] = WORK_MOVES[from as WorkStatus] ?? [];
	return values.filter((value) => moves.includes(value));
}

/**
 * Decides whether a governed value may move to `to`. Intent-spec alignment moves
 * freely between its values, including back to `unreviewed`; plans, todo lists
 * and briefs share one lifecycle where completed and abandoned are final. A file
 * with no valid value starts from the kind's starting value, so the allowed
 * values are that value plus its next values, which keeps a status-less plan from
 * jumping to completed. Refusals carry the allowed list and whether the current
 * value is final. The tool never chooses a value; this only enforces legality.
 */
export default function checkTransition({
	kind,
	current,
	to,
}: {
	kind: GovernedKind;
	current: CurrentValue;
	to: string;
}): { ok: true } | { ok: false; final: boolean; allowed: string[] } {
	const { initial } = GOVERNED_FIELDS[kind];
	const allowed =
		current.state === "set"
			? nextValues(kind, current.value)
			: [initial, ...nextValues(kind, initial)];
	if (allowed.includes(to)) return { ok: true };
	return { ok: false, final: current.state === "set" && allowed.length === 0, allowed };
}
