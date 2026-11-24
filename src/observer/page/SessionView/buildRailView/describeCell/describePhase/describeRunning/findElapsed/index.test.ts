import { describe, expect, it } from "vitest";
import makeRailContext from "@/observer/page/__fixtures__/makeRailContext/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import findElapsed from "./index.js";

const statusWith = (work: ReturnType<typeof makeWork>[]) => makeStatus({ running: work, generatedAt: NOW.toISOString() });

describe("findElapsed", () => {
	it("is null with no status", () => {
		expect(findElapsed({ phase: "build", ctx: makeRailContext() })).toBeNull();
	});

	it("is null when no running work matches the rail's session, phase and module", () => {
		const ctx = makeRailContext({ status: statusWith([makeWork({ phase: "qa" }), makeWork({ sessionId: "s2" }), makeWork({ module: "src/other" })]) });
		expect(findElapsed({ phase: "build", ctx })).toBeNull();
	});

	it("is the status's elapsed time as the now card counts it", () => {
		const ctx = makeRailContext({ status: statusWith([makeWork({ phase: "build", elapsedMs: 125_000 })]) });
		expect(findElapsed({ phase: "build", ctx })).toBe("2m 05s");
	});

	it("keeps counting from when the status was built", () => {
		const generatedAt = new Date(NOW.getTime() - 30_000).toISOString();
		const ctx = makeRailContext({ status: makeStatus({ running: [makeWork({ phase: "build", elapsedMs: 60_000 })], generatedAt }) });
		expect(findElapsed({ phase: "build", ctx })).toBe("1m 30s");
	});

	it("matches the module whatever form the event recorded it in", () => {
		const ctx = makeRailContext({ status: statusWith([makeWork({ phase: "build", module: "/work/app/src/tools/score", elapsedMs: 10_000 })]) });
		expect(findElapsed({ phase: "build", ctx })).toBe("10s");
	});
});
