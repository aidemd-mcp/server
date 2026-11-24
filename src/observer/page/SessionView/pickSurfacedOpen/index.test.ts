import { describe, expect, it } from "vitest";
import type { WaitingFile } from "@/types/index.js";
import pickSurfacedOpen from "./index.js";

function waiting({ file, kind, folder, seq }: { file: string; kind: WaitingFile["kind"]; folder: string; seq: number }): WaitingFile {
	return { file, kind, folder, gate: "approve", sessionId: "s1", seq, since: "2026-01-01T09:00:00.000Z" };
}

const plan = waiting({ file: "src/a/plan.aide", kind: "plan", folder: "src/a", seq: 3 });

describe("pickSurfacedOpen", () => {
	it("opens the first surfaced file and returns its key", () => {
		expect(pickSurfacedOpen({ surfaced: plan, lastKey: null })).toEqual({
			key: "src/a/plan.aide#s1#3",
			open: { kind: "file", path: "src/a/plan.aide" },
		});
	});

	it("opens nothing for the same key again", () => {
		expect(pickSurfacedOpen({ surfaced: plan, lastKey: "src/a/plan.aide#s1#3" })).toEqual({ key: "src/a/plan.aide#s1#3", open: null });
	});

	it.each<[WaitingFile["kind"], string]>([
		["todo", "src/b/todo.aide"],
		["intent", "src/b/.aide"],
		["brief", "src/b/brief.aide"],
	])("opens a different %s file as that file, whatever its kind", (kind, file) => {
		const surfaced = waiting({ file, kind, folder: "src/b", seq: 4 });
		expect(pickSurfacedOpen({ surfaced, lastKey: "src/a/plan.aide#s1#3" }).open).toEqual({ kind: "file", path: file });
	});

	it("clears the key and opens nothing when nothing is surfaced, so the same file surfacing again (a new event) opens", () => {
		const first = pickSurfacedOpen({ surfaced: plan, lastKey: null });
		const cleared = pickSurfacedOpen({ surfaced: null, lastKey: first.key });
		expect(cleared).toEqual({ key: null, open: null });

		const again = pickSurfacedOpen({ surfaced: { ...plan, seq: 9 }, lastKey: cleared.key });
		expect(again.key).toBe("src/a/plan.aide#s1#9");
		expect(again.open).toEqual({ kind: "file", path: "src/a/plan.aide" });
	});
});
