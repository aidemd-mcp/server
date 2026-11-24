import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readSessionRecord from "./index.js";

// Same text as the default export of src/tools/scaffold/sessionTemplate/index.ts, copied
// rather than imported: status must not import @/tools.
const PLACEHOLDER = `---
intent: >
  Nothing recorded yet.
---

# AIDE SESSION

Cold-start protocol for agents reorienting on this project.

## State summary

## Kanban

## The architectural intent (what the specs say after the rewrite)

## Anti-regression invariants future build phases must hold

## Where this cycle stopped (CRITICAL READING)

### What the next agent must do

### What's already done and validated

### What's left after the current cycle

## Process discipline (permanent)

## Open questions
`;

let projectRoot: string;

async function writeRecord(text: string): Promise<void> {
	await mkdir(join(projectRoot, ".aide"), { recursive: true });
	await writeFile(join(projectRoot, ".aide", "session.aide"), text, "utf-8");
}

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "status-session-"));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

describe("readSessionRecord", () => {
	it("reads the scaffolded placeholder: every heading present, all markdown empty", async () => {
		await writeRecord(PLACEHOLDER);

		const result = await readSessionRecord({ projectRoot });

		expect(result.state).toBe("present");
		if (result.state !== "present") return;
		expect(result.intent).toBe("Nothing recorded yet.");
		expect(result.sections.map((s) => s.heading)).toEqual([
			"State summary",
			"Kanban",
			"The architectural intent (what the specs say after the rewrite)",
			"Anti-regression invariants future build phases must hold",
			"Where this cycle stopped (CRITICAL READING)",
			"Process discipline (permanent)",
			"Open questions",
		]);
		for (const section of result.sections) {
			expect(section.markdown).toBe("");
			for (const sub of section.subsections) expect(sub.markdown).toBe("");
		}
		const stopped = result.sections.find((s) => s.heading.startsWith("Where this cycle stopped"));
		expect(stopped?.subsections.map((s) => s.heading)).toEqual([
			"What the next agent must do",
			"What's already done and validated",
			"What's left after the current cycle",
		]);
	});

	it("keeps subsections in order with their numbered lists intact", async () => {
		await writeRecord(`---
intent: >
  Ship the observer.
---

## Where this cycle stopped (CRITICAL READING)

Lead-in text.

### What the next agent must do

1. Build step 3.
2. Run the tests.

### What's already done and validated

1. Step 1 built.
`);

		const result = await readSessionRecord({ projectRoot });

		if (result.state !== "present") throw new Error("expected present");
		const [section] = result.sections;
		expect(section.markdown).toBe("Lead-in text.");
		expect(section.subsections).toEqual([
			{ heading: "What the next agent must do", markdown: "1. Build step 3.\n2. Run the tests." },
			{ heading: "What's already done and validated", markdown: "1. Step 1 built." },
		]);
	});

	it("keeps numbered decisions with gaps verbatim", async () => {
		await writeRecord(`---
intent: x
---

## The architectural intent (what the specs say after the rewrite)

1. First.
2. Second.
5. Fifth.
`);

		const result = await readSessionRecord({ projectRoot });

		if (result.state !== "present") throw new Error("expected present");
		expect(result.sections[0].markdown).toBe("1. First.\n2. Second.\n5. Fifth.");
	});

	it("collects text before the first ## heading as the preamble", async () => {
		await writeRecord(PLACEHOLDER);

		const result = await readSessionRecord({ projectRoot });

		if (result.state !== "present") throw new Error("expected present");
		expect(result.preamble).toContain("# AIDE SESSION");
	});

	it("reports a missing file as missing", async () => {
		expect(await readSessionRecord({ projectRoot })).toEqual({ state: "missing" });
	});

	it("reports broken frontmatter as unreadable", async () => {
		await writeRecord("---\nintent: [unclosed\n---\n\n## State summary\n");

		const result = await readSessionRecord({ projectRoot });

		expect(result.state).toBe("unreadable");
	});
});
