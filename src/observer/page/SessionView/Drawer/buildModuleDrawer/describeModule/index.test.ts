import { describe, expect, it } from "vitest";
import buildModules from "@/observer/page/SessionView/buildModules/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import describeModule from "./index.js";

const FOLDER = "src/tools/score";

function rowIn(tree = [SCORE_NODE]) {
	return buildModules({ tree })[0]!;
}

describe("describeModule", () => {
	it("states alignment, plan status with its count, and working now", () => {
		const context = makeContext({ status: makeStatus({ tree: [SCORE_NODE], running: [makeWork()] }) });
		expect(describeModule({ folder: FOLDER, row: rowIn(), context })).toBe("aligned · plan approved 3/9 · working now");
	});

	it("leaves out working now when the followed session does not run the module", () => {
		const context = makeContext({ status: makeStatus({ tree: [SCORE_NODE], running: [makeWork({ sessionId: "s2" })] }) });
		expect(describeModule({ folder: FOLDER, row: rowIn(), context })).toBe("aligned · plan approved 3/9");
	});

	it("reads a running module recorded as an absolute path", () => {
		const context = makeContext({ status: makeStatus({ tree: [SCORE_NODE], running: [makeWork({ module: "/work/app/src/tools/score" })] }) });
		expect(describeModule({ folder: FOLDER, row: rowIn(), context })).toContain("working now");
	});

	it("is null when the observer reported nothing about the module", () => {
		expect(describeModule({ folder: FOLDER, row: null, context: makeContext({ status: null }) })).toBeNull();
	});
});
