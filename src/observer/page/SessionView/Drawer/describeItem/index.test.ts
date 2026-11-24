import { describe, expect, it } from "vitest";
import type { DrawerContext } from "@/observer/page/types/index.js";
import describeItem from "./index.js";

const CONTEXT: DrawerContext = { token: "t", projectKey: "k", status: null, events: [], sessions: [], focus: "s1", now: new Date("2026-11-23T12:00:00Z") };

describe("describeItem", () => {
	it.each([
		[{ kind: "module", folder: "src/a" }, { kind: "Module", title: "src/a", titleMono: true }],
		[{ kind: "file", path: "src/a/plan.aide" }, { kind: "Module", title: "src/a", titleMono: true }],
		[{ kind: "file", path: "src/a/index.ts" }, { kind: "File", title: "src/a/index.ts", titleMono: true }],
		[{ kind: "task", slug: "fix-it" }, { kind: "Kanban task", title: "fix-it", titleMono: false }],
		[{ kind: "event", sessionId: "s1", seq: 4 }, { kind: "Event", title: "s1:4", titleMono: true }],
	] as const)("describes %j", (item, expected) => {
		expect(describeItem({ item, context: CONTEXT })).toEqual(expected);
	});
});
