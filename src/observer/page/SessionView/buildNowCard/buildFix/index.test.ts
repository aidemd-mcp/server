import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeFile from "@/observer/page/__fixtures__/makeFile/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import type { WorkFileEntry } from "@/types/index.js";
import buildFix from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number): string => new Date(2026, 10, 23, hours, minutes).toISOString();

const work = makeWork({ phase: "fix", agent: "aide-implementor", module: "src/tools/score", startedAt: at(14, 30), elapsedMs: 120_000, qaFixRound: 2 });
const todo = makeFile({ kind: "todo", folder: "src/tools/score", file: "src/tools/score/todo.aide", done: 3, total: 5 }) as WorkFileEntry;
const verdict = (seq: number, open: number) => makeEvent({ seq, ts: at(14, 20 + seq), kind: "qa_verdict", module: "src/tools/score", verdict: "issues", open });

function build({ round = 2, withTodo = true, events = [verdict(1, 2)] }: { round?: number | null; withTodo?: boolean; events?: ReturnType<typeof verdict>[] } = {}) {
	const status = makeStatus({ generatedAt: at(14, 34), workFiles: withTodo ? [todo] : [] });
	return buildFix({ status, events, work: { ...work, qaFixRound: round ?? undefined }, now: NOW });
}

describe("buildFix", () => {
	it("is the red loop card for the Fix phase with its agent and module", () => {
		const card = build();
		expect(card).toMatchObject({ kind: "fix", icon: "loop", title: "Fix", titleMono: null, steps: null });
		expect(card.parts).toEqual([
			{ label: "agent", value: "aide-implementor", mono: true },
			{ label: "module", value: "src/tools/score", mono: true },
		]);
	});

	it("names the round in the state and the timer label", () => {
		const card = build();
		expect(card.state).toBe("QA → Fix · round 2");
		expect(card.timeLabel).toBe("elapsed · round 2 started 14:30");
		expect(card.time).toBe("2m 00s");
	});

	it("infers no round when the observer reported none", () => {
		const card = build({ round: null });
		expect(card.state).toBe("QA → Fix");
		expect(card.timeLabel).toBe("elapsed · started 14:30");
		expect(card.hint).toBeNull();
	});

	it("says how many of the todo's issues are open when the status read it", () => {
		expect(build().sub).toBe("2 of 5 issues open");
		expect(build({ withTodo: false }).sub).toBeNull();
	});

	it("words the newest QA verdict's open count as the hint", () => {
		expect(build({ events: [verdict(1, 4), verdict(2, 1)] }).hint).toBe("QA round 2 found 1 still open in todo.aide.");
	});

	it("has no hint when no verdict reported an open count", () => {
		expect(build({ events: [] }).hint).toBeNull();
	});
});
