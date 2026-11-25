import type { RailContext } from "@/observer/page/types/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";

/** A rail context for `src/tools/score` in session `s1` with no stages, status or events; `overrides` set what a test cares about. */
export default function makeRailContext(overrides: Partial<RailContext> = {}): RailContext {
	return { stages: [], module: "src/tools/score", sessionId: "s1", projectRoot: "/work/app", status: null, pipelineEvents: [], now: NOW, ...overrides };
}
