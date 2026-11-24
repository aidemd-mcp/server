import { describe, expect, it } from "vitest";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import buildErrorDrawer from "./index.js";

const clock = (iso: string): string => formatClock({ iso, now: NOW }).clock;
const TS = "2026-11-23T14:47:00.000Z";

const error = (fields: Record<string, unknown> = {}) => makeEvent({ seq: 1, ts: TS, kind: "error", message: "timed out\n  at rank.ts:1", ...fields }) as never;

describe("buildErrorDrawer", () => {
	it("titles the drawer by the message's first line and keeps the whole message as one block", () => {
		const drawer = buildErrorDrawer({ event: error(), context: makeContext() });
		expect(drawer).toMatchObject({ kind: "Error", title: "timed out", titleMono: false });
		expect(drawer.blocks).toEqual([{ heading: "Message", icon: "error", badge: null, type: "pre", text: "timed out\n  at rank.ts:1" }]);
	});

	it("is only the time when the error reported no agent or module", () => {
		expect(buildErrorDrawer({ event: error(), context: makeContext() }).meta).toBe(clock(TS));
	});

	it("names the agent and the project-relative module", () => {
		const context = makeContext({ status: makeStatus({ projectRoot: "/work/app" }) });
		const drawer = buildErrorDrawer({ event: error({ agent: "aide-qa", module: "/work/app/src/tools/score" }), context });
		expect(drawer.meta).toBe(`aide-qa · src/tools/score · ${clock(TS)}`);
	});

	it("keeps a module as reported when the project has no status", () => {
		const drawer = buildErrorDrawer({ event: error({ module: "src/a" }), context: makeContext({ status: null }) });
		expect(drawer.meta).toBe(`src/a · ${clock(TS)}`);
	});
});
