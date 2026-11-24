import type { RunningWork } from "@/types/index.js";

/** One running phase on the score module. */
export default function makeWork(overrides: Partial<RunningWork> = {}): RunningWork {
	return {
		sessionId: "s1",
		phase: "build",
		agent: "aide-implementor",
		module: "src/tools/score",
		startedAt: "2026-11-23T14:20:00.000Z",
		elapsedMs: 60_000,
		...overrides,
	};
}
