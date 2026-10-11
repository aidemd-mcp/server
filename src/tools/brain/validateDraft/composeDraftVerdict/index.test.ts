import { describe, it, expect } from "vitest";
import type { BrainDraftFinding } from "@/types/index.js";
import composeDraftVerdict from "./index.js";

const relativePath = "drafts/brain.aide";

const findings: BrainDraftFinding[] = [
	{ kind: "valid" },
	{ kind: "absent" },
	{ kind: "missing-sections", sections: ["config", "orientation"] },
	{ kind: "malformed", reason: "frontmatter is missing the name field" },
];

describe("composeDraftVerdict", () => {
	it.each(findings)("names the draft path for the $kind finding", (finding) => {
		expect(composeDraftVerdict({ relativePath, finding })).toContain(`\`${relativePath}\``);
	});

	it("lists every missing section in the given order", () => {
		const verdict = composeDraftVerdict({
			relativePath,
			finding: { kind: "missing-sections", sections: ["config", "orientation", "playbook-index"] },
		});
		expect(verdict).toContain("config, orientation, playbook-index");
	});

	it("carries the malformed reason verbatim", () => {
		const reason = "unknown marker token <!-- banana:start -->";
		const verdict = composeDraftVerdict({ relativePath, finding: { kind: "malformed", reason } });
		expect(verdict).toContain(`is malformed: ${reason}.`);
	});

	it("points the valid draft at the host swap and the state re-check", () => {
		const verdict = composeDraftVerdict({ relativePath, finding: { kind: "valid" } });
		expect(verdict).toContain(".aide/config/brain.aide");
		expect(verdict).toContain("aide_info");
	});

	it("points the missing-sections branch at the template read", () => {
		const verdict = composeDraftVerdict({
			relativePath,
			finding: { kind: "missing-sections", sections: ["config"] },
		});
		expect(verdict).toContain('`source: "template"`');
	});

	it.each(findings)("never points the $kind branch at the host-file repairs", (finding) => {
		const verdict = composeDraftVerdict({ relativePath, finding });
		expect(verdict).not.toContain("aide_upgrade");
		expect(verdict).not.toContain("/aide:brain config");
	});

	it.each(findings)("never names a backend in the $kind branch", (finding) => {
		expect(composeDraftVerdict({ relativePath, finding })).not.toMatch(/\bobsidian\b|vault|mcp__/i);
	});
});
