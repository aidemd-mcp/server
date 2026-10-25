import { describe, it, expect } from "vitest";
import type { CleanupEphemeral } from "@/types/index.js";
import judgeEphemeral from "./index.js";

const FILES: CleanupEphemeral[] = ["plan.aide", "todo.aide", "brief.aide"];
const CHECKED = "- [x] done";
const OPEN = "- [ ] first\n- [x] second\n- [ ] third";

/** Builds a file body: frontmatter holding the given status line (or none) followed by the body text. */
function make(status: string | null, body: string): string {
	const head = status === null ? "intent: x" : `intent: x\nstatus: ${status}`;
	return `---\n${head}\n---\n\n${body}\n`;
}

function judge(file: CleanupEphemeral, content: string) {
	return judgeEphemeral({ file, content });
}

describe("judgeEphemeral", () => {
	describe.each(FILES)("%s", (file) => {
		it("closes an abandoned file even with open items", () => {
			expect(judge(file, make("abandoned", OPEN))).toEqual({ verdict: "closed" });
		});

		it("closes a completed file with every item checked", () => {
			expect(judge(file, make("completed", CHECKED))).toEqual({ verdict: "closed" });
		});

		it("closes a completed file with zero checkboxes", () => {
			expect(judge(file, make("completed", "no boxes"))).toEqual({ verdict: "closed" });
		});

		it.each(["proposed", "approved"])("treats %s as open-status", (status) => {
			expect(judge(file, make(status, CHECKED))).toEqual({ verdict: "open-status", status, items: [] });
		});

		it("rejects the retired in-flight status", () => {
			expect(judge(file, make("in-flight", CHECKED))).toEqual({
				verdict: "invalid-status",
				detail: 'status "in-flight" is not a valid status here',
			});
		});

		it("rejects a status that is not valid here", () => {
			expect(judge(file, make("aligned", CHECKED))).toEqual({
				verdict: "invalid-status",
				detail: 'status "aligned" is not a valid status here',
			});
		});

		it("rejects unparsable frontmatter", () => {
			const verdict = judge(file, "---\nstatus: [unclosed\n---\n\n- [x] done\n");
			expect(verdict.verdict).toBe("invalid-status");
			if (verdict.verdict !== "invalid-status") return;
			expect(verdict.detail).toMatch(/^its frontmatter cannot be parsed \(.+\)$/s);
		});

		it("does not read an abandoned status written only in the body", () => {
			const verdict = judge(file, `---\nintent: x\n---\n\nstatus: abandoned\n\n${OPEN}\n`);
			if (file === "brief.aide") expect(verdict).toEqual({ verdict: "closed" });
			else expect(verdict.verdict).toBe("no-status-open");
		});

		it("gives the same verdicts for CRLF files", () => {
			for (const status of ["abandoned", "completed", "proposed", "approved", "in-flight", null]) {
				const lf = make(status, OPEN);
				expect(judge(file, lf.replace(/\n/g, "\r\n"))).toEqual(judge(file, lf));
			}
		});
	});

	describe.each(["plan.aide", "todo.aide"] as const)("%s items", (file) => {
		it("returns completed-open naming each open item, tagged with the file", () => {
			expect(judge(file, make("completed", OPEN))).toEqual({
				verdict: "completed-open",
				items: [
					{ file, line: 6, text: "first" },
					{ file, line: 8, text: "third" },
				],
			});
		});

		it("returns open-status carrying the open items", () => {
			expect(judge(file, make("approved", OPEN))).toEqual({
				verdict: "open-status",
				status: "approved",
				items: [
					{ file, line: 6, text: "first" },
					{ file, line: 8, text: "third" },
				],
			});
		});

		it("returns no-status-empty for a status-less file with zero checkboxes", () => {
			expect(judge(file, make(null, "no boxes"))).toEqual({ verdict: "no-status-empty" });
		});

		it("returns no-status-open for a status-less file with open items", () => {
			expect(judge(file, make(null, OPEN))).toEqual({
				verdict: "no-status-open",
				items: [
					{ file, line: 5, text: "first" },
					{ file, line: 7, text: "third" },
				],
			});
		});

		it("closes a status-less file with every item checked", () => {
			expect(judge(file, make(null, CHECKED))).toEqual({ verdict: "closed" });
		});

		it("closes a file with no frontmatter block when every item is checked", () => {
			expect(judge(file, `${CHECKED}\n`)).toEqual({ verdict: "closed" });
		});
	});

	describe("brief.aide", () => {
		it("reads a brief's checkboxes only when it records completed", () => {
			expect(judge("brief.aide", make(null, OPEN))).toEqual({ verdict: "closed" });
			expect(judge("brief.aide", make("completed", CHECKED))).toEqual({ verdict: "closed" });
			expect(judge("brief.aide", make("approved", OPEN))).toEqual({
				verdict: "open-status",
				status: "approved",
				items: [],
			});
		});

		it("returns completed-open naming each open item of a completed brief, tagged with brief.aide", () => {
			expect(judge("brief.aide", make("completed", OPEN))).toEqual({
				verdict: "completed-open",
				items: [
					{ file: "brief.aide", line: 6, text: "first" },
					{ file: "brief.aide", line: 8, text: "third" },
				],
			});
		});

		it("closes an abandoned brief with open items", () => {
			expect(judge("brief.aide", make("abandoned", OPEN))).toEqual({ verdict: "closed" });
		});

		it("closes a status-less brief with zero checkboxes", () => {
			expect(judge("brief.aide", make(null, "prose only"))).toEqual({ verdict: "closed" });
		});
	});

	describe("a todo shaped like QA's", () => {
		it("parses intent plus a misalignment list before status: completed", () => {
			const content = [
				"---",
				"intent: >",
				"  Fix the gaps QA found.",
				"misalignment:",
				"  - plan",
				"  - code",
				"status: completed",
				"---",
				"",
				"- [x] fixed",
				"",
			].join("\n");
			expect(judge("todo.aide", content)).toEqual({ verdict: "closed" });
		});
	});
});
