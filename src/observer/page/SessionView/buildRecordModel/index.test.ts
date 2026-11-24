import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@/types/index.js";
import buildRecordModel from "./index.js";

function present(sections: Extract<SessionRecord, { state: "present" }>["sections"]): SessionRecord {
	return { state: "present", intent: "Ship the page.", preamble: "", sections };
}

describe("buildRecordModel", () => {
	it("says why there is no record: missing gets its explanation, unreadable the observer's error", () => {
		expect(buildRecordModel({ record: { state: "missing" } })).toEqual({
			kind: "missing",
			message: ".aide/session.aide isn't there yet; it appears once the agent writes it.",
		});
		expect(buildRecordModel({ record: { state: "unreadable", error: "EACCES" } })).toEqual({ kind: "unreadable", message: "EACCES" });
	});

	it("lifts the stop section out as pinned, lists it first in the outline and keeps file order for the rest", () => {
		const model = buildRecordModel({
			record: present([
				{ heading: "State summary", markdown: "Steps 1-8 done.", subsections: [] },
				{ heading: "Where this cycle stopped", markdown: "Between steps.", subsections: [] },
				{ heading: "Kanban", markdown: "- a\n- b", subsections: [] },
			]),
		});
		if (model.kind !== "present") throw new Error("expected a present record");
		expect(model.pinned?.heading).toBe("Where this cycle stopped");
		expect(model.sections.map((section) => section.heading)).toEqual(["State summary", "Kanban"]);
		expect(model.outline.map((entry) => [entry.label, entry.pinned])).toEqual([
			["Where this cycle stopped", true],
			["State summary", false],
			["Kanban", false],
		]);
	});

	it("gives each section its file position as id, so equal headings stay distinct", () => {
		const model = buildRecordModel({
			record: present([
				{ heading: "Notes", markdown: "one", subsections: [] },
				{ heading: "Notes", markdown: "two", subsections: [] },
			]),
		});
		if (model.kind !== "present") throw new Error("expected a present record");
		expect(model.sections.map((section) => section.id)).toEqual(["rec-0", "rec-1"]);
		expect(model.outline.map((entry) => entry.id)).toEqual(["rec-0", "rec-1"]);
	});

	it("counts list items with the subsections' as text: blank for none and for the pinned section", () => {
		const model = buildRecordModel({
			record: present([
				{
					heading: "Where this cycle stopped",
					markdown: "Stopped.",
					subsections: [{ heading: "What the next agent must do", markdown: "1. A\n2. B" }],
				},
				{ heading: "Kanban", markdown: "- a → Done\n- b → Todo", subsections: [] },
				{ heading: "State summary", markdown: "Prose only.", subsections: [] },
			]),
		});
		if (model.kind !== "present") throw new Error("expected a present record");
		expect(model.outline.map((entry) => entry.count)).toEqual(["", "2", ""]);
	});

	it("carries the calm text on a section with no text, Open questions with the handoff's own", () => {
		const model = buildRecordModel({
			record: present([
				{ heading: "Open questions", markdown: " ", subsections: [] },
				{ heading: "Kanban", markdown: "", subsections: [] },
				{ heading: "Left", markdown: "", subsections: [{ heading: "Later", markdown: "- one" }] },
			]),
		});
		if (model.kind !== "present") throw new Error("expected a present record");
		expect(model.sections.map((section) => section.empty)).toEqual([
			"No open questions recorded for this cycle.",
			"Nothing recorded for this cycle yet.",
			null,
		]);
	});

	it("has no pinned section when the record names none", () => {
		const model = buildRecordModel({ record: present([{ heading: "State summary", markdown: "x", subsections: [] }]) });
		if (model.kind !== "present") throw new Error("expected a present record");
		expect(model.pinned).toBeNull();
		expect(model.outline.map((entry) => entry.pinned)).toEqual([false]);
	});
});
