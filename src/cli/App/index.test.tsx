import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import App from "./index.js";
import type { TreeNode } from "@/types/index.js";

// Mock scan so App's toggleDeepView doesn't hit filesystem.
vi.mock("@/util/scan/index.js", () => ({
	default: vi.fn().mockResolvedValue({ root: "/mock", files: [] }),
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

	it("shows file entries in the tree panel", () => {
		const { lastFrame } = render(<App root="/mock" initialNodes={mockNodes} />);
		const frame = lastFrame() ?? "";
		expect(frame).toContain(".aide");
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

	it("moves cursor down on down arrow", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		stdin.write("\x1B[B"); // down arrow
		await flush();
		const frame = lastFrame() ?? "";
		// Component still renders without crash.
		expect(frame).toContain("Intent Tree");
	});

	it("switches to drill-in mode on Enter and renders card layout (scope, intent, outcomes)", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Move down to first file node (index 1 = the .aide file child).
		stdin.write("\x1B[B");
		await flush();
		stdin.write("\r"); // Enter — selectedFile is now .aide
		await flush();
		// Wait for async readFile to resolve.
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame() ?? "";
		// Drill-in card layout must show scope, intent text, and outcomes sections.
		expect(frame).toContain("scope:");
		expect(frame).toContain("cli");
		expect(frame).toContain("terminal-native");
		expect(frame).toContain("Desired Outcomes");
		expect(frame).toContain("Undesired Outcomes");
		// Footer hint for drill-in mode.
		expect(frame).toContain("[esc] back");
		expect(frame).toContain("expand section");
	});

	it("drill-in mode: Up/Down moves section focus and Enter expands the focused section", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Navigate to file and drill in.
		stdin.write("\x1B[B");
		await flush();
		stdin.write("\r"); // Enter
		await flush();
		await new Promise((r) => setTimeout(r, 50));

		// In drill-in mode, focus starts at section 0 (Context).
		// Press Down to move focus to section 1 (Strategy).
		stdin.write("\x1B[B");
		await flush();
		// Press Enter to expand the focused section (Strategy).
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameAfterExpand = lastFrame() ?? "";
		// The expanded section should show its content.
		expect(frameAfterExpand).toContain("Strategy");
		expect(frameAfterExpand).toContain("▾"); // expanded indicator

		// Press Enter again to collapse it.
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frameAfterCollapse = lastFrame() ?? "";
		expect(frameAfterCollapse).toContain("▸"); // collapsed indicator
	});

	it("drill-in mode: Up arrow moves section focus, Enter expands that section", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		// Navigate to file and drill in.
		stdin.write("\x1B[B");
		await flush();
		stdin.write("\r"); // Enter
		await flush();
		await new Promise((r) => setTimeout(r, 50));

		// Move focus down to section 1 then back up to section 0.
		stdin.write("\x1B[B"); // down
		await flush();
		stdin.write("\x1B[A"); // up — back to section 0 (Context)
		await flush();
		// Expand section 0 (Context).
		stdin.write("\r");
		await flush();
		await new Promise((r) => setTimeout(r, 20));
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Context");
		expect(frame).toContain("▾"); // section 0 is expanded
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

	it("Escape in drill-in mode returns to tree view", async () => {
		const { lastFrame, stdin } = render(<App root="/mock" initialNodes={mockNodes} />);
		stdin.write("\x1B[B");
		await flush();
		stdin.write("\r"); // Enter drill-in
		await flush();
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\x1B"); // Escape back
		await new Promise((r) => setTimeout(r, 30)); // escape flush delay
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Intent Tree");
		expect(frame).toContain("Detail");
	});
});
