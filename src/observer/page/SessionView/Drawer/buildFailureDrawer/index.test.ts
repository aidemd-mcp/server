import { describe, expect, it } from "vitest";
import type { DrawerContext } from "@/observer/page/types/index.js";
import buildFailureDrawer from "./index.js";

const CONTEXT: DrawerContext = { token: "t", projectKey: "k", status: null, events: [], sessions: [], focus: "s1", now: new Date("2026-11-23T12:00:00Z") };

describe("buildFailureDrawer", () => {
	it("keeps the item's header and shows the observer's message as the only block", () => {
		expect(buildFailureDrawer({ item: { kind: "task", slug: "gone" }, message: "Task not found", context: CONTEXT })).toEqual({
			kind: "Task",
			title: "gone",
			titleMono: false,
			meta: null,
			blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: "Task not found" }],
		});
	});
});
