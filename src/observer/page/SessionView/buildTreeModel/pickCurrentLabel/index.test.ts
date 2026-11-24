import { describe, expect, it } from "vitest";
import type { NowCardModel } from "@/observer/page/types/index.js";
import pickCurrentLabel from "./index.js";

function makeCard(kind: NowCardModel["kind"], title = "Build"): NowCardModel {
	return { kind, state: "", icon: "run", title, titleMono: null, sub: null, parts: [], time: null, timeLabel: null, steps: null, hint: null };
}

describe("pickCurrentLabel", () => {
	it.each([
		["run", "Build", "Working now · Build"],
		["fix", "Fix", "Working now · Fix"],
		["wait", "Approve", "Waiting on you"],
		["idle", "Last: QA passed", "Last worked on"],
	] as const)("a %s card (%s) labels the module `%s`", (kind, title, label) => {
		expect(pickCurrentLabel({ card: makeCard(kind, title) })).toBe(label);
	});

	it("labels nothing before any activity", () => {
		expect(pickCurrentLabel({ card: makeCard("empty") })).toBeNull();
	});
});
