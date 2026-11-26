import { describe, expect, it } from "vitest";
import type { BoardUnavailable } from "@/types/index.js";
import buildUnavailable from "./index.js";

const READ_AT = new Date(2026, 10, 23, 14, 5, 9).toISOString();

function board(reason: BoardUnavailable["reason"], detail: string, hint = "Set the brain path."): BoardUnavailable {
	return { state: "unavailable", reason, detail, hint };
}

describe("buildUnavailable", () => {
	it.each(["kanban-folder-missing", "board-read-failed"] as const)("is the error notice for %s, with the detail and the time of the last read", (reason) => {
		const model = buildUnavailable({ board: board(reason, "D:/brain"), readAt: READ_AT });
		expect(model).toEqual({
			kind: "unavailable",
			tone: "err",
			heading: "Board can't load right now",
			text: "The kanban folder isn't reachable (D:/brain). Everything else on this page is live.",
			meta: "Read again on every new event and page load · last try 14:05:09",
		});
	});

	it.each(["no-brain-config", "brain-config-unreadable", "no-kanban-field", "kanban-field-malformed", "unsupported-source", "no-kanban-tag", "board-folder-missing"] as const)("is a calm notice for %s, in the observer's words", (reason) => {
		const model = buildUnavailable({ board: board(reason, "the brain config declares no kanban field"), readAt: READ_AT });
		expect(model.tone).toBe("calm");
		expect(model.heading).toBe("Board unavailable");
		expect(model.text).toBe("The brain config declares no kanban field. Set the brain path.");
		expect(model.meta).toBeNull();
	});

	it("does not double the full stop of a detail that already ends in one", () => {
		const model = buildUnavailable({ board: board("no-kanban-tag", "No tag reported.", "Add one."), readAt: READ_AT });
		expect(model.text).toBe("No tag reported. Add one.");
	});
});
