import { describe, expect, it } from "vitest";
import emptyText from "./index.js";

describe("emptyText", () => {
	it("reads the handoff's sentence for Open questions, whatever the case", () => {
		expect(emptyText("Open questions")).toBe("No open questions recorded for this cycle.");
		expect(emptyText("OPEN QUESTIONS")).toBe("No open questions recorded for this cycle.");
	});

	it.each(["Where this cycle stopped", "Kanban", "What's left after the current cycle", "Architectural intent"])(
		"reads the generic text for %s",
		(heading) => {
			expect(emptyText(heading)).toBe("Nothing recorded for this cycle yet.");
		},
	);
});
