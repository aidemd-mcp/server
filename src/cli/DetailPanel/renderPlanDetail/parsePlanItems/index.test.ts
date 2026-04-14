import { describe, it, expect } from "vitest";
import parsePlanItems from "./index.js";

// ---------------------------------------------------------------------------
// Fixtures extracted from real plan files in this project
// ---------------------------------------------------------------------------

/**
 * Format from src/cli/plan.aide — numbered heading with inline `[x]` checkbox.
 * Steps 1-2 are complete, step 3 (truncated) is partial. Items are prose
 * (non-checklist) sub-steps — they have no `- [ ]` marker of their own.
 */
const CLI_PLAN_FIXTURE = `
### 1. [x] Add \`description\` field to AideFile and populate it during scan

Read: \`coding-playbook/foundations/conventions.md\`

- Modify \`src/types/index.ts\`: add an optional \`description?: string\` field to the \`AideFile\` interface.
- Modify \`src/util/scan/index.ts\`: after the existing \`extractSummary\` call, also parse frontmatter.
- Write \`src/util/scan/index.test.ts\`: test that scan populates \`description\` from frontmatter.

### 2. [x] Tree panel: show descriptions unconditionally and widen to 55-60%

Read: \`coding-playbook/foundations/conventions.md\`

- 2a. Modify \`src/cli/TreePanel/index.tsx\` — \`renderRow\` function.
- 2b. Modify \`src/cli/App/index.tsx\` — the layout section.
- 2c. Verify the \`TreePanelProps\` interface does not need changes.

### 3. [ ] Detail panel: add plan layout renderer

Read: \`coding-playbook/foundations/conventions.md\`, \`coding-playbook/workflow/testing.md\`

Create a new helper component at \`src/cli/DetailPanel/renderPlanDetail/index.tsx\`.
`.trim();

/**
 * Format from src/tools/init/plan.aide — Phase heading with em-dash, items
 * carry `- [x] **N.N bold label.** prose` or `- [x] plain` checkboxes.
 */
const INIT_PLAN_FIXTURE = `
### Phase 1 — Type changes

- [x] **1.1 Add \`"created"\` to \`InitStepStatus\` in \`src/types/index.ts\`.**
  The union becomes \`"would-create" | "would-skip" | "exists" | "created"\`.

- [x] **1.2 Add \`brainPath\` to \`InitInput\` Zod schema in \`src/tools/init/index.ts\`.**
  Add \`brainPath: z.string().optional()\`.

### Phase 2 — Write-to-disk helper

- [x] **2.1 Create \`src/tools/init/applySteps/index.ts\`.**
  Export default function \`applySteps(steps: InitStep[]): Promise<InitStep[]>\`.

### Phase 3 — Orchestrator changes

- [x] **3.1 Update init orchestrator signature in \`src/tools/init/index.ts\`.**

- [ ] **3.2 Remove the sentinel brain path logic from the orchestrator.**
`.trim();

/**
 * Format from src/tools/init/provisionBrain/plan.aide — numbered headings
 * without inline checkbox, items carry `- [x]` / `- [ ]` checkboxes.
 */
const PROVISION_BRAIN_FIXTURE = `
### 1. Update applySteps to handle brain-category file steps

- [x] In \`src/tools/init/applySteps/index.ts\`, modify the brain-category branch.
- [x] Update the JSDoc on \`applySteps\`.
- [x] Add tests in \`src/tools/init/applySteps/index.test.ts\`.

### 2. Add the playbook hub template to provisionBrain

- [x] 2a. In \`src/tools/init/provisionBrain/index.ts\`, add a \`PLAYBOOK_HUB_TEMPLATE\` constant.
- [x] 2b. Add a \`buildPlaybookHubStep\` async function.
- [ ] 2c. Wire \`buildPlaybookHubStep\` into the orchestrator function.
`.trim();

// ---------------------------------------------------------------------------
// Real-format fixture tests
// ---------------------------------------------------------------------------

describe("parsePlanItems — real plan file formats", () => {
	it("parses cli/plan.aide format: numbered heading with inline [x] checkbox, prose items ignored", () => {
		const result = parsePlanItems(CLI_PLAN_FIXTURE);

		expect(result).toHaveLength(3);

		// Step 1 — complete, heading carries [x]
		expect(result[0].step).toBe(
			"Add `description` field to AideFile and populate it during scan",
		);
		expect(result[0].done).toBe(true);
		// Prose items have no `- [ ]` markers, so items array is empty
		expect(result[0].items).toHaveLength(0);

		// Step 2 — complete
		expect(result[1].step).toBe(
			"Tree panel: show descriptions unconditionally and widen to 55-60%",
		);
		expect(result[1].done).toBe(true);
		expect(result[1].items).toHaveLength(0);

		// Step 3 — incomplete
		expect(result[2].step).toBe("Detail panel: add plan layout renderer");
		expect(result[2].done).toBe(false);
		expect(result[2].items).toHaveLength(0);
	});

	it("parses init/plan.aide format: Phase N — Title headings with - [x] items", () => {
		const result = parsePlanItems(INIT_PLAN_FIXTURE);

		expect(result).toHaveLength(3);

		// Phase 1
		expect(result[0].step).toBe("Type changes");
		expect(result[0].items).toHaveLength(2);
		expect(result[0].items[0].done).toBe(true);
		expect(result[0].items[0].text).toMatch(/1\.1 Add/);
		expect(result[0].items[1].done).toBe(true);
		expect(result[0].items[1].text).toMatch(/1\.2 Add/);

		// Phase 2
		expect(result[1].step).toBe("Write-to-disk helper");
		expect(result[1].items).toHaveLength(1);
		expect(result[1].items[0].done).toBe(true);

		// Phase 3 — mixed: one done, one not
		expect(result[2].step).toBe("Orchestrator changes");
		expect(result[2].items).toHaveLength(2);
		expect(result[2].items[0].done).toBe(true);
		expect(result[2].items[1].done).toBe(false);
		expect(result[2].done).toBe(false);
	});

	it("parses provisionBrain/plan.aide format: numbered headings with - [x] / - [ ] items", () => {
		const result = parsePlanItems(PROVISION_BRAIN_FIXTURE);

		expect(result).toHaveLength(2);

		// Step 1 — all items done, step derives done=true
		expect(result[0].step).toBe(
			"Update applySteps to handle brain-category file steps",
		);
		expect(result[0].items).toHaveLength(3);
		expect(result[0].items.every((i) => i.done)).toBe(true);
		expect(result[0].done).toBe(true);

		// Step 2 — 2c is incomplete, step derives done=false
		expect(result[1].step).toBe("Add the playbook hub template to provisionBrain");
		expect(result[1].items).toHaveLength(3);
		expect(result[1].items[0].done).toBe(true);
		expect(result[1].items[1].done).toBe(true);
		expect(result[1].items[2].done).toBe(false);
		expect(result[1].done).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Synthetic edge-case tests
// ---------------------------------------------------------------------------

describe("parsePlanItems — edge cases", () => {
	it("returns an empty array for an empty body string", () => {
		expect(parsePlanItems("")).toEqual([]);
	});

	it("returns an empty array when no checklist items or headings exist", () => {
		const body = "This is just prose.\nNo steps here.";
		expect(parsePlanItems(body)).toEqual([]);
	});

	it("handles all items complete under a numbered heading", () => {
		const body = `
### 1. Complete step

- [x] Item A
- [x] Item B
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		expect(result[0].done).toBe(true);
		expect(result[0].items.every((i) => i.done)).toBe(true);
	});

	it("handles all items incomplete under a numbered heading", () => {
		const body = `
### 1. Pending step

- [ ] Item A
- [ ] Item B
- [ ] Item C
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		expect(result[0].done).toBe(false);
		expect(result[0].items.every((i) => !i.done)).toBe(true);
	});

	it("groups items appearing before any heading under an empty-string step", () => {
		const body = `
- [x] Preamble item
- [ ] Another preamble item

### 1. Named step

- [x] Named item
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(2);
		expect(result[0].step).toBe("");
		expect(result[0].items).toHaveLength(2);
		expect(result[1].step).toBe("Named step");
	});

	it("preserves correct done state for uppercase [X] items", () => {
		const body = `
### 1. Step

- [X] Uppercase checked
- [ ] Unchecked
`.trim();

		const result = parsePlanItems(body);
		expect(result[0].items[0].done).toBe(true);
		expect(result[0].items[1].done).toBe(false);
	});

	it("ignores non-checklist lines within a step block", () => {
		const body = `
### 1. Step with prose

Some description paragraph.

- [x] Real item
- Another line that isn't a checklist item
- [ ] Another real item
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		expect(result[0].items).toHaveLength(2);
		expect(result[0].items[0].text).toBe("Real item");
		expect(result[0].items[1].text).toBe("Another real item");
	});

	it("handles a step heading with no checklist items", () => {
		const body = `
### 1. Empty step

Some prose only.
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		expect(result[0].step).toBe("Empty step");
		expect(result[0].items).toHaveLength(0);
		expect(result[0].done).toBe(false);
	});

	it("handles multiple steps with no items between them", () => {
		const body = `
### 1. First step

### 2. Second step

- [ ] Only in second
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(2);
		expect(result[0].items).toHaveLength(0);
		expect(result[1].items).toHaveLength(1);
	});

	it("parses inline [x] heading as done=true regardless of items", () => {
		const body = `
### 1. [x] Done step with no items

Some prose only — no checklist.
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		expect(result[0].done).toBe(true);
		expect(result[0].step).toBe("Done step with no items");
		expect(result[0].items).toHaveLength(0);
	});

	it("parses inline [ ] heading as done=false", () => {
		const body = `
### 3. [ ] Pending step

- [x] Already done sub-task
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		// Inline [ ] in heading overrides all-done items: step is not done
		expect(result[0].done).toBe(false);
		expect(result[0].items[0].done).toBe(true);
	});

	it("parses Phase heading with en-dash separator", () => {
		const body = `
### Phase 1 – Setup

- [x] Item one
- [ ] Item two
`.trim();

		const result = parsePlanItems(body);
		expect(result).toHaveLength(1);
		expect(result[0].step).toBe("Setup");
		expect(result[0].items).toHaveLength(2);
	});
});
