/** What the handoff writes for `src/tools/score` beyond a generic module: its spec, plan steps, todo items and retro. */
const SCORE_CONTENT = {
	spec: {
		intent: "Point the next agent at the module that most needs attention.",
		desired: [
			"Misaligned specs rank above unreviewed, unreviewed above aligned",
			"Ties break by open todo count, then path",
			"Output is stable for the same tree",
		],
		undesired: ["Ranking depends on file system order", "Aligned modules with open todos hidden"],
		sections: {
			Context:
				"Agents call aide_score at the start of a cycle. Today it sorts by modified time, which buries misaligned specs.",
			Strategy:
				"Compute a weight per node from alignment, then open work; keep the scoring pure so it can be golden-tested.",
		} as Record<string, string>,
	},
	/** The nine numbered steps of the handoff's plan drawer; step 2 carries its 2a and 2b rows as its own checkboxes. */
	planSteps: [
		{ text: "Add AlignmentWeight to src/domain/alignment" },
		{
			text: "Create weights.ts with the ordering table",
			subs: ["2a. Misaligned 3, unreviewed 2, aligned 1", "2b. Unit tests for each weight"],
		},
		{ text: "Expose weight on tree nodes" },
		{ text: "Wire weights into the aide_score ranking" },
		{ text: "Break ties by open todo count, then path" },
		{ text: "Golden test with the fixture project" },
		{ text: "Update tool description" },
		{ text: "Changelog entry" },
		{ text: "Remove modified-time sort" },
	] as { text: string; subs?: string[] }[],
	/** The handoff's five todo issues, the two it leaves open first. */
	todoItems: [
		{ location: "src/tools/score/rank.ts:42", text: "Ties fall back to insertion order, not path" },
		{ location: "src/tools/score/rank.test.ts:118", text: "No case for a misaligned leaf under an aligned parent" },
		{ location: "src/tools/score/weights.ts:9", text: "Weight table not frozen; callers can mutate it" },
		{ location: "src/tools/score/rank.ts:67", text: "Open todo count read twice per node" },
		{ location: "src/tools/score/index.ts:15", text: "Tool description still says “by modified time”" },
	],
	retro: [
		"Round 1 missed tie-breaking because the plan step said “stable” without saying stable by what.",
		"Golden fixture should include a misaligned leaf under an aligned parent.",
	],
};

export default SCORE_CONTENT;
