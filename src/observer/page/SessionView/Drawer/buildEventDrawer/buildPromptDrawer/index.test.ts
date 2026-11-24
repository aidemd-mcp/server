import { describe, expect, it } from "vitest";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import buildPromptDrawer from "./index.js";

const clock = (iso: string): string => formatClock({ iso, now: NOW }).clock;
const prompt = makeEvent({ seq: 2, ts: "2026-11-23T14:03:00.000Z", kind: "prompt", text: "Pick up the next p1.\nThen stop." });
const started = makeEvent({ seq: 1, ts: "2026-11-23T14:02:00.000Z", kind: "session_started" });

describe("buildPromptDrawer", () => {
	it("words the kind with the prompt's time and titles it by the first line", () => {
		const drawer = buildPromptDrawer({ event: prompt as never, context: makeContext({ events: [started, prompt] }) });
		expect(drawer.kind).toBe(`Prompt · ${clock(prompt.ts)}`);
		expect(drawer.title).toBe("Pick up the next p1.");
		expect(drawer.titleMono).toBe(false);
	});

	it("names the session start in the meta line", () => {
		const drawer = buildPromptDrawer({ event: prompt as never, context: makeContext({ events: [started, prompt] }) });
		expect(drawer.meta).toBe(`session ${clock(started.ts)}`);
	});

	it("takes the session start from the first held event when no session_started is held", () => {
		expect(buildPromptDrawer({ event: prompt as never, context: makeContext({ events: [prompt] }) }).meta).toBe(`session ${clock(prompt.ts)}`);
	});

	it("leaves the meta line out when the session has no held event at all", () => {
		expect(buildPromptDrawer({ event: prompt as never, context: makeContext({ events: [] }) }).meta).toBeNull();
	});

	it("carries the whole text as one block", () => {
		const { blocks } = buildPromptDrawer({ event: prompt as never, context: makeContext({ events: [prompt] }) });
		expect(blocks).toEqual([{ heading: "Full text", icon: "prompt", badge: null, type: "pre", text: "Pick up the next p1.\nThen stop." }]);
	});
});
