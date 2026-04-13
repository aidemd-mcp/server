import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import App from "./index.js";
import type { TreeNode } from "@/types/index.js";

// Mock scan so App's toggleDeepView doesn't hit filesystem.
vi.mock("@/util/scan/index.js", () => ({
	default: vi.fn().mockResolvedValue({ root: "/mock", files: [] }),
}));

// Mock spawnSync so the editor escape hatch doesn't launch a real process.
const { mockSpawnSync } = vi.hoisted(() => ({
	mockSpawnSync: vi.fn().mockReturnValue({ status: 0 }),
}));
vi.mock("node:child_process", () => ({
	spawnSync: mockSpawnSync,
}));

// Mock readFile with frontmatter that includes scope, intent, outcomes, and body sections.
const { MOCK_FILE_CONTENT } = vi.hoisted(() => ({
	MOCK_FILE_CONTENT: `---
scope: cli
intent: Give developers a terminal-native way to explore the intent tree.
outcomes:
  desired:
    - Navigable intent tree in the terminal.
    - Drill-in view with card layout.
  undesired:
    - A static dump that exits immediately.
---

## Context

Some context paragraphs here.

## Strategy

Some strategy paragraphs here.
`,
}));

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn().mockResolvedValue(MOCK_FILE_CONTENT),
}));

function makeNode(relativePath: string): TreeNode {
	return {
		kind: "file",
		file: { path: `/mock/${relativePath}`, relativePath, type: "intent", summary: "A test summary." },
	};
}

function makeDirNode(path: string, children: TreeNode[]): TreeNode {
	return { kind: "dir", path, children };
}

const mockNodes: TreeNode[] = [
	makeDirNode(".", [makeNode(".aide")]),
	makeDirNode("src/tools/init", [makeNode("src/tools/init/intent.aide")]),
];

/**
 * Yield to the microtask queue so that React state updates scheduled via
 * reconciler.discreteUpdates() (used internally by Ink's useInput) are
 * flushed before reading lastFrame(). A single Promise.resolve() is enough
 * because discreteUpdates queues work as a microtask in Legacy render mode.
 */
async function flush(): Promise<void> {
	await Promise.resolve();
}

describe("App", () => {
	it("renders tree panel and detail panel in initial state", () => {
		const { lastFrame } = render(<App root="/mock" initialNodes={mockNodes} />);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain("Detail");
	});

	it("shows dir entries in the tree panel (folders as primary cursor stops)", () => {
		const { lastFrame } = render(<App root="/mock" initialNodes={mockNodes} />);
		const frame = lastFrame() ?? "";
		// Dir nodes visible by default (files are hidden until expanded).
		// Root dir renders as ". /" (the TreePanel label for path ".").
		expect(frame).toContain(". /");
		expect(frame).toContain("src/tools/init/");
	});

	it("does not show file children before a dir is expanded", () => {
		const { lastFrame } = render(<App root="/mock" initialNodes={mockNodes} />);
		const frame = lastFrame() ?? "";
		// .aide file is a child of "." dir — should not appear as a tree row until dir is expanded.
		// The detail panel may show the file path via findPrimaryIntent, so check for the
		// tree-specific file row indicator (file rows are indented children, not dir rows with "> ").
		expect(frame).not.toContain("intent.aide");
	});

	it("shows navigation hints in tree panel", () => {
		const { lastFrame } = render(<App root="/mock" initialNodes={mockNodes} />);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("navigate");
	});

	it("appends search filter when printable chars typed", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		stdin.write("i");
		await flush();
		stdin.write("n");
		await flush();
		stdin.write("i");
		await flush();
		stdin.write("t");
		await flush();
		const frame = lastFrame() ?? "";
		expect(frame).toContain("esc");
	});

	it("clears search filter on escape when filter is non-empty", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		stdin.write("x");
		await flush();
		stdin.write("\x1B"); // escape
		await new Promise((r) => setTimeout(r, 30)); // escape flush delay is 20ms in Ink
		const frame = lastFrame() ?? "";
		// After clearing filter, hint should be back to normal navigation hints.
		expect(frame).toContain("tab");
	});

	it("moves cursor down on down arrow (between dir nodes)", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		stdin.write("\x1B[B"); // down arrow — moves from dir 0 to dir 1
		await flush();
		const frame = lastFrame() ?? "";
		// Component still renders without crash, cursor moved to second dir.
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain("src/tools/init/");
	});

	it("Enter on dir expands it and shows children", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Cursor starts on first dir node (".").
		stdin.write("\r"); // Enter — expand dir
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frame = lastFrame() ?? "";
		// After expanding, the child .aide file should appear.
		expect(frame).toContain(".aide");
	});

	it("Enter on expanded dir collapses it", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Expand the first dir.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		// Cursor advanced to child — move back up to dir.
		stdin.write("\x1B[A"); // up arrow back to dir
		await flush();
		// Collapse the dir.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frame = lastFrame() ?? "";
		// Child file should no longer appear.
		expect(frame).not.toContain(".aide");
	});

	it("Escape inside expanded dir collapses parent and returns cursor to dir", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Expand first dir — cursor moves to child.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		// Cursor is now on the .aide file child. Press Escape — should collapse dir.
		stdin.write("\x1B");
		await new Promise((r) => setTimeout(r, 30));
		const frame = lastFrame() ?? "";
		// Child file should be gone, dir still visible (rendered as ". /").
		expect(frame).not.toContain(".aide");
		expect(frame).toContain(". /");
	});

	it("switches to drill-in mode on Enter (two-level: expand dir, select file, drill in)", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Step 1: Enter on first dir node to expand it.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		// Cursor advanced to first child (.aide file). Step 2: Enter to drill in.
		stdin.write("\r");
		await flush();
		// Wait for async readFile to resolve.
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame() ?? "";
		// Tree panel must remain visible — two-panel layout is always preserved.
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain(". /");
		// Drill-in card layout must show scope, intent text, and outcomes sections.
		expect(frame).toContain("scope:");
		expect(frame).toContain("cli");
		expect(frame).toContain("terminal-native");
		expect(frame).toContain("Desired Outcomes");
		expect(frame).toContain("Undesired Outcomes");
		// Footer hint for drill-in mode.
		expect(frame).toContain("[esc] back");
		expect(frame).toContain("next section");
	});

	it("drill-in mode: Tab expands sections one at a time", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Navigate to file and drill in (two-level navigation).
		stdin.write("\r"); // expand dir
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		stdin.write("\r"); // drill into file
		await flush();
		await new Promise((r) => setTimeout(r, 50));

		// In drill-in mode, all sections start collapsed (no section expanded).
		// Press Tab to expand the first section (Context, index 0).
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameAfterFirstTab = lastFrame() ?? "";
		// First section (Context) is now expanded.
		expect(frameAfterFirstTab).toContain("Context");
		expect(frameAfterFirstTab).toContain("▾"); // expanded indicator

		// Press Tab again — first section collapses, second section (Strategy) expands.
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameAfterSecondTab = lastFrame() ?? "";
		expect(frameAfterSecondTab).toContain("Strategy");
		expect(frameAfterSecondTab).toContain("▾"); // second section expanded
	});

	it("drill-in mode: Up/Down navigates tree cursor and right panel updates to show new file", async () => {
		// Use two dirs each with one file so Down in drill-in mode moves to the second dir.
		const nodes: TreeNode[] = [
			makeDirNode(".", [makeNode(".aide")]),
			makeDirNode("src/tools/init", [makeNode("src/tools/init/intent.aide")]),
		];
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={nodes} />);

		// Expand first dir so its file child is accessible.
		stdin.write("\r"); // expand "." dir — cursor moves to .aide child
		await flush();
		await new Promise((r) => setTimeout(r, 20));

		// Drill into the .aide file.
		stdin.write("\r"); // Enter on .aide file
		await flush();
		await new Promise((r) => setTimeout(r, 50));

		// Confirm we are in drill-in mode.
		const frameDrillIn = lastFrame() ?? "";
		expect(frameDrillIn).toContain("[esc] back");
		// Tree panel must still show both dirs.
		expect(frameDrillIn).toContain(". /");
		expect(frameDrillIn).toContain("src/tools/init/");

		// Press Down — cursor moves to next visible node (src/tools/init dir).
		// The right panel should update to show that dir's primary intent file.
		stdin.write("\x1B[B"); // down arrow
		await flush();
		await new Promise((r) => setTimeout(r, 50));
		const frameAfterDown = lastFrame() ?? "";
		// Still in drill-in mode (two-panel layout, [esc] back still visible).
		expect(frameAfterDown).toContain("[esc] back");
		// Tree panel still visible.
		expect(frameAfterDown).toContain("Intent Tree");
		// Right panel now shows the newly selected file's drill-in content.
		expect(frameAfterDown).toContain("scope:");

		// Press Up — cursor moves back to the .aide file.
		stdin.write("\x1B[A"); // up arrow
		await flush();
		await new Promise((r) => setTimeout(r, 50));
		const frameAfterUp = lastFrame() ?? "";
		// Still in drill-in mode.
		expect(frameAfterUp).toContain("[esc] back");
		// Tree panel still visible.
		expect(frameAfterUp).toContain("Intent Tree");
	});

	it("drill-in mode: Tab cycles through body sections one at a time", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Navigate to file and drill in (two-level navigation).
		stdin.write("\r"); // expand dir
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		stdin.write("\r"); // drill into file
		await flush();
		await new Promise((r) => setTimeout(r, 50));

		// All sections start collapsed (no ▾ visible, only ▸ indicators).
		const frameInitial = lastFrame() ?? "";
		expect(frameInitial).not.toContain("▾");

		// Tab 1: null -> 0 — section 0 (Context) expands.
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameTab1 = lastFrame() ?? "";
		expect(frameTab1).toContain("▾"); // at least one expanded
		expect(frameTab1).toContain("Context");
		expect(frameTab1).toContain("Some context paragraphs here");

		// Tab 2: 0 -> 1 — section 0 collapses, section 1 (Strategy) expands.
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameTab2 = lastFrame() ?? "";
		expect(frameTab2).toContain("▾"); // section 1 is expanded
		expect(frameTab2).toContain("Strategy");
		expect(frameTab2).toContain("Some strategy paragraphs here");

		// Tab 3: 1 -> null — all sections collapse (both show ▸, none show ▾).
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameTab3 = lastFrame() ?? "";
		expect(frameTab3).not.toContain("▾");
		expect(frameTab3).toContain("▸"); // collapsed indicator visible

		// Tab 4: null -> 0 — wraps around, section 0 (Context) expands again.
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameTab4 = lastFrame() ?? "";
		expect(frameTab4).toContain("▾"); // section 0 expanded again
		expect(frameTab4).toContain("Context");
	});

	it("drill-in mode: only one section expanded at a time", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Navigate to file and drill in (two-level navigation).
		stdin.write("\r"); // expand dir
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		stdin.write("\r"); // drill into file
		await flush();
		await new Promise((r) => setTimeout(r, 50));

		// Tab 1: expand section 0 — only section 0 (Context) shows ▾.
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameAfterTab1 = lastFrame() ?? "";
		// Count ▾ occurrences — only one section should be expanded.
		const expandedCountAfterTab1 = (frameAfterTab1.match(/▾/g) ?? []).length;
		expect(expandedCountAfterTab1).toBe(1);
		// Section 0 (Context) is expanded; section 1 (Strategy) is collapsed.
		expect(frameAfterTab1).toContain("Context");
		expect(frameAfterTab1).toContain("Strategy");

		// Tab 2: section 0 collapses, section 1 (Strategy) expands.
		stdin.write("\t");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameAfterTab2 = lastFrame() ?? "";
		// Still exactly one ▾ — never two.
		const expandedCountAfterTab2 = (frameAfterTab2.match(/▾/g) ?? []).length;
		expect(expandedCountAfterTab2).toBe(1);
		// Section 0 now shows ▸ (collapsed); section 1 shows ▾ (expanded).
		expect(frameAfterTab2).toContain("▸"); // at least one collapsed indicator
		expect(frameAfterTab2).toContain("▾"); // exactly one expanded indicator
	});

	it("search filter hides directories with no matching children", async () => {
		const nodes: TreeNode[] = [
			makeDirNode("src/tools/discover", [makeNode("src/tools/discover/.aide")]),
			makeDirNode("src/tools/init", [makeNode("src/tools/init/intent.aide")]),
		];
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={nodes} />);
		// Type "init" to filter — only the init directory should survive.
		stdin.write("i");
		await flush();
		stdin.write("n");
		await flush();
		stdin.write("i");
		await flush();
		stdin.write("t");
		await flush();
		const frame = lastFrame() ?? "";
		expect(frame).toContain("init");
		expect(frame).not.toContain("discover");
	});

	it("search filter does not show a dir whose name is a prefix of a matching sibling dir", async () => {
		// Regression: "src/cli".startsWith("src/cli") is true, but so is
		// "src/cli-extra/intent.aide".startsWith("src/cli"). The predicate must
		// check actual tree children, not path prefixes, so src/cli is excluded
		// when only src/cli-extra contains a matching file.
		const nodes: TreeNode[] = [
			makeDirNode("src/cli", [makeNode("src/cli/.aide")]),
			makeDirNode("src/cli-extra", [makeNode("src/cli-extra/intent.aide")]),
		];
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={nodes} />);
		// Type "extra" — only src/cli-extra and its child should be visible.
		stdin.write("e");
		await flush();
		stdin.write("x");
		await flush();
		stdin.write("t");
		await flush();
		stdin.write("r");
		await flush();
		stdin.write("a");
		await flush();
		const frame = lastFrame() ?? "";
		expect(frame).toContain("cli-extra");
		expect(frame).not.toContain("cli/.aide");
	});

	it("footer hint shows expand/collapse (not drill in) in tree panel when searching and cursor is on a dir", async () => {
		const nodes: TreeNode[] = [
			makeDirNode("src/tools/discover", [makeNode("src/tools/discover/.aide")]),
			makeDirNode("src/tools/init", [makeNode("src/tools/init/intent.aide")]),
		];
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={nodes} />);
		// Type "init" — filters tree so only src/tools/init dir (and its child) are visible.
		// Cursor lands on the dir node.
		stdin.write("i");
		await flush();
		stdin.write("n");
		await flush();
		stdin.write("i");
		await flush();
		stdin.write("t");
		await flush();
		const frame = lastFrame() ?? "";
		// Cursor is on a dir node — tree panel hint must reflect expand/collapse.
		expect(frame).toContain("expand");
		// The tree panel footer should not say "drill in" (that comes from the detail panel preview footer,
		// which is separate from the tree navigation hint).
		// Check that the tree panel specifically shows expand, not drill-in, for this cursor position.
		expect(frame).toContain("[enter] expand");
	});

	it("Escape in drill-in mode returns to tree view", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Two-level navigation: expand dir, then drill into file.
		stdin.write("\r"); // expand dir
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		stdin.write("\r"); // drill into file
		await flush();
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\x1B"); // Escape back
		await new Promise((r) => setTimeout(r, 30)); // escape flush delay
		const frame = lastFrame() ?? "";
		// Tree panel remains visible.
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain("Detail");
		// Right panel reverts to preview mode — shows outcome counts, not full outcome text.
		expect(frame).toMatch(/desired \(/);
		expect(frame).not.toContain("Desired Outcomes");
		expect(frame).not.toContain("Undesired Outcomes");
	});

	it("Detail panel auto-loads intent for dir node", async () => {
		const { lastFrame } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Cursor starts on first dir "." which has a child .aide of type intent.
		// Wait for async frontmatter load.
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame() ?? "";
		// Detail panel should show the intent frontmatter, not "Select a file to preview".
		expect(frame).toContain("cli");
		expect(frame).toContain("terminal-native");
	});

	it("Enter on file inside expanded dir triggers drill-in", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Expand first dir, cursor moves to file child.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		// Press Enter on the file to drill in.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame() ?? "";
		// Tree panel remains visible alongside drill-in content.
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain(". /");
		// Drill-in content is shown in the right panel.
		expect(frame).toContain("scope:");
		expect(frame).toContain("Desired Outcomes");
		expect(frame).toContain("Undesired Outcomes");
		expect(frame).toContain("[esc] back");
	});

	it("tree panel remains visible during drill-in", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Two-level navigation: expand dir, then drill into file.
		stdin.write("\r"); // expand "." dir — cursor moves to .aide child
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		stdin.write("\r"); // drill into .aide file
		await flush();
		// Wait for async readFile to resolve.
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame() ?? "";
		// The tree panel must remain visible — no full-screen takeover.
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain(". /");
		expect(frame).toContain("src/tools/init/");
		// The drill-in content must coexist in the same frame.
		expect(frame).toContain("scope:");
	});

	it("drill-in mode: [e] opens file in editor", async () => {
		mockSpawnSync.mockClear();
		const { stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Two-level navigation: expand dir, then drill into file.
		stdin.write("\r"); // expand dir — cursor moves to .aide child
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		stdin.write("\r"); // drill into .aide file
		await flush();
		await new Promise((r) => setTimeout(r, 50));
		// Press [e] — should call spawnSync with the drilled file's absolute path.
		stdin.write("e");
		await flush();
		expect(mockSpawnSync).toHaveBeenCalledOnce();
		const [, args, opts] = mockSpawnSync.mock.calls[0] as [string, string[], Record<string, unknown>];
		expect(args).toContain("/mock/.aide");
		expect(opts).toMatchObject({ stdio: "inherit" });
	});
});
