import { describe, it, expect } from "vitest";
import type { UpgradeFileResult } from "@/types/index.js";
import composeBrainInstructions from "./index.js";

function makeBrainFile(overrides: Partial<UpgradeFileResult>): UpgradeFileResult {
	return {
		name: ".aide/config/brain.aide",
		filePath: "/some/.aide/config/brain.aide",
		status: "differs",
		category: "brain",
		...overrides,
	};
}

const MISSING =
	"Brain config is behind — missing required sections: kanban-index, kanban-create. Run /aide:brain config to add them.";
const STALE =
	"Brain config has sections whose text is an outdated template version: orientation, config. Run /aide:brain config to review each as its own before/after change.";
const LEGACY =
	"Brain launcher is legacy (unpinned, missing-auto-confirm). Run /aide:brain config to review the launcher change.";

describe("composeBrainInstructions", () => {
	it("returns the existing missing-sections sentence unchanged", () => {
		const file = makeBrainFile({ missingSections: ["kanban-index", "kanban-create"] });
		expect(composeBrainInstructions(file)).toBe(MISSING);
	});

	it("returns only the stale-sections sentence", () => {
		const file = makeBrainFile({ staleSections: ["orientation", "config"] });
		expect(composeBrainInstructions(file)).toBe(STALE);
	});

	it("returns only the legacy-launcher sentence with reasons in order", () => {
		const file = makeBrainFile({ legacyLauncher: ["unpinned", "missing-auto-confirm"] });
		expect(composeBrainInstructions(file)).toBe(LEGACY);
	});

	it("concatenates all three in order, joined by one space", () => {
		const file = makeBrainFile({
			missingSections: ["kanban-index", "kanban-create"],
			staleSections: ["orientation", "config"],
			legacyLauncher: ["unpinned", "missing-auto-confirm"],
		});
		expect(composeBrainInstructions(file)).toBe(`${MISSING} ${STALE} ${LEGACY}`);
	});

	it("emits only sentences for fields present: empty staleSections and absent legacyLauncher", () => {
		const file = makeBrainFile({
			missingSections: ["kanban-index", "kanban-create"],
			staleSections: [],
		});
		expect(composeBrainInstructions(file)).toBe(MISSING);
	});
});
