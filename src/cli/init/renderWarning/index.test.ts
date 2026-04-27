import { describe, it, expect } from "vitest";
import renderWarning from "./index.js";
import type { InstallResult } from "../types/index.js";

const BORDER = "=".repeat(60);

function makeSkipped(displayPath: string, message = "already present"): InstallResult {
    return { status: "exists", displayPath, message };
}

function makeFailed(displayPath: string, message = "EACCES: permission denied"): InstallResult {
    return { status: "failed", displayPath, message };
}

describe("renderWarning", () => {
    it("returns empty string when skipped, failed, and deferred are all empty (suppression rule)", () => {
        const result = renderWarning({ skipped: [], failed: [], deferredCategories: [] });
        expect(result).toBe("");
    });

    it("deferred-only: block contains heading, deferred list, and next-step line but no skipped-files heading", () => {
        const deferred = [
            "Brain wiring (.aide/config/brain.aide + derived brain MCP entry) — open Claude Code and run /aide; the orchestrator will prompt for the brain root path, scaffold .aide/config/brain.aide, and tell you to run npx aidemd-mcp sync",
            "IDE configuration",
        ];
        const result = renderWarning({ skipped: [], failed: [], deferredCategories: deferred });

        const expected = [
            "",
            BORDER,
            "  SETUP INCOMPLETE — ACTION REQUIRED",
            BORDER,
            "",
            "  Deferred (each item names how to finish it):",
            "    1. Brain wiring (.aide/config/brain.aide + derived brain MCP entry) — open Claude Code and run /aide; the orchestrator will prompt for the brain root path, scaffold .aide/config/brain.aide, and tell you to run npx aidemd-mcp sync",
            "    2. IDE configuration",
            "",
            BORDER,
        ].join("\n");

        expect(result).toBe(expected);
        expect(result).not.toContain("Skipped files");
    });

    it("skipped-only: block contains skipped list but no deferred-categories heading", () => {
        const skipped = [makeSkipped(".claude/CLAUDE.md")];
        const result = renderWarning({ skipped, failed: [], deferredCategories: [] });

        const expected = [
            "",
            BORDER,
            "  SETUP INCOMPLETE — ACTION REQUIRED",
            BORDER,
            "",
            "  Skipped files (already on disk or write failed — not overwritten):",
            "    1. .claude/CLAUDE.md — already present",
            "",
            BORDER,
        ].join("\n");

        expect(result).toBe(expected);
        expect(result).not.toContain("Deferred categories");
    });

    it("failed-only: failed entries appear in the skipped-files list (merged presentation)", () => {
        const failed = [makeFailed(".claude/agents/aide-architect.md", "EACCES: permission denied")];
        const result = renderWarning({ skipped: [], failed, deferredCategories: [] });

        const expected = [
            "",
            BORDER,
            "  SETUP INCOMPLETE — ACTION REQUIRED",
            BORDER,
            "",
            "  Skipped files (already on disk or write failed — not overwritten):",
            "    1. .claude/agents/aide-architect.md — EACCES: permission denied",
            "",
            BORDER,
        ].join("\n");

        expect(result).toBe(expected);
        expect(result).not.toContain("Deferred categories");
    });

    it("full block: skipped + failed + deferred all present — sections appear in order (skipped first, deferred second)", () => {
        const skipped = [makeSkipped(".claude/CLAUDE.md", "already present")];
        const failed = [makeFailed(".aide/docs/index.md", "write failed")];
        const deferred = [
            "Brain wiring (.aide/config/brain.aide + derived brain MCP entry) — open Claude Code and run /aide; the orchestrator will prompt for the brain root path, scaffold .aide/config/brain.aide, and tell you to run npx aidemd-mcp sync",
        ];

        const result = renderWarning({ skipped, failed, deferredCategories: deferred });

        const expected = [
            "",
            BORDER,
            "  SETUP INCOMPLETE — ACTION REQUIRED",
            BORDER,
            "",
            "  Skipped files (already on disk or write failed — not overwritten):",
            "    1. .claude/CLAUDE.md — already present",
            "    2. .aide/docs/index.md — write failed",
            "",
            "  Deferred (each item names how to finish it):",
            "    1. Brain wiring (.aide/config/brain.aide + derived brain MCP entry) — open Claude Code and run /aide; the orchestrator will prompt for the brain root path, scaffold .aide/config/brain.aide, and tell you to run npx aidemd-mcp sync",
            "",
            BORDER,
        ].join("\n");

        expect(result).toBe(expected);
        // Verify order: skipped section index is before deferred section index
        expect(result.indexOf("Skipped files")).toBeLessThan(result.indexOf("Deferred (each item names how to finish it):"));
    });

    it("border characters are '=' repeated 60 times", () => {
        const result = renderWarning({
            skipped: [makeSkipped("any/path.md")],
            failed: [],
            deferredCategories: [],
        });
        const expectedBorder = "=".repeat(60);
        // The heading is wrapped above and below by a border; a third border closes the block
        expect(result).toContain(expectedBorder);
        // The border is exactly 60 '=' characters — not 59, not 61
        expect(result).not.toContain("=".repeat(61));
        // Three border lines: before heading, after heading, closing the block
        const occurrences = result.split(expectedBorder).length - 1;
        expect(occurrences).toBe(3);
    });
});
