import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import TreePanel from "./index.js";
import type { FlatNode } from "@/cli/flattenTree/index.js";
import type { AideFile } from "@/types/index.js";

function fileRow(
	relativePath: string,
	type: AideFile["type"],
	workStatus?: AideFile["workStatus"],
	alignment?: AideFile["alignment"],
): FlatNode {
	return {
		depth: 1,
		node: {
			kind: "file",
			file: {
				path: `/mock/${relativePath}`,
				relativePath,
				type,
				summary: "",
				...(workStatus ? { workStatus } : {}),
				...(alignment ? { alignment } : {}),
			},
		},
	};
}

function dirRow(path: string, intentAlignment?: AideFile["alignment"]): FlatNode {
	return {
		depth: 0,
		node: {
			kind: "dir",
			path,
			children: [fileRow(`${path}/.aide`, "intent", undefined, intentAlignment).node],
		},
	};
}

function renderRows(nodes: FlatNode[]): string {
	const { lastFrame } = render(
		<TreePanel
			visibleNodes={nodes}
			cursorIndex={0}
			searchFilter=""
			isDeepView={false}
			expandedDirs={new Set()}
			cursorOnDir={false}
			cursorDirExpanded={false}
			width={120}
		/>,
	);
	return lastFrame() ?? "";
}

describe("TreePanel plan and todo tags", () => {
	it.each(["proposed", "approved", "completed", "abandoned"] as const)(
		"renders a plan with workStatus %s as [plan: %s]",
		(workStatus) => {
			expect(renderRows([fileRow("src/plan.aide", "plan", workStatus)])).toContain(`plan.aide [plan: ${workStatus}]`);
		},
	);

	it.each(["proposed", "approved", "completed", "abandoned"] as const)(
		"renders a todo with workStatus %s as [todo: %s]",
		(workStatus) => {
			expect(renderRows([fileRow("src/todo.aide", "todo", workStatus)])).toContain(`todo.aide [todo: ${workStatus}]`);
		},
	);

	it("keeps the plain [plan] and [todo] tags when there is no workStatus", () => {
		const frame = renderRows([fileRow("src/plan.aide", "plan"), fileRow("src/todo.aide", "todo")]);
		expect(frame).toContain("plan.aide [plan]");
		expect(frame).toContain("todo.aide [todo]");
	});

	it("never puts a workStatus inside an intent tag", () => {
		expect(renderRows([fileRow("src/.aide", "intent", "approved")])).toContain(".aide [intent]");
	});
});

describe("TreePanel alignment badge", () => {
	describe("file rows", () => {
		it("renders [aligned] after the intent tag for an aligned spec", () => {
			expect(renderRows([fileRow("src/.aide", "intent", undefined, "aligned")])).toContain(".aide [intent] [aligned]");
		});

		it("renders [misaligned] after the intent tag for a misaligned spec", () => {
			expect(renderRows([fileRow("src/.aide", "intent", undefined, "misaligned")])).toContain(".aide [intent] [misaligned]");
		});

		it("renders no badge for an unreviewed spec", () => {
			const frame = renderRows([fileRow("src/.aide", "intent", undefined, "unreviewed")]);
			expect(frame).toContain(".aide [intent]");
			expect(frame).not.toContain("aligned]");
			expect(frame).not.toContain("unreviewed");
		});

		it("renders no badge when alignment is absent", () => {
			const frame = renderRows([fileRow("src/.aide", "intent")]);
			expect(frame).toContain(".aide [intent]");
			expect(frame).not.toContain("aligned]");
		});
	});

	describe("directory row", () => {
		it("renders [aligned] when the intent spec of the dir is aligned", () => {
			expect(renderRows([dirRow("src/cli", "aligned")])).toContain("src/cli/ [aligned]");
		});

		it("renders [misaligned] when the intent spec of the dir is misaligned", () => {
			expect(renderRows([dirRow("src/cli", "misaligned")])).toContain("src/cli/ [misaligned]");
		});

		it("renders no badge when the intent spec of the dir is unreviewed", () => {
			const frame = renderRows([dirRow("src/cli", "unreviewed")]);
			expect(frame).toContain("src/cli/");
			expect(frame).not.toContain("aligned]");
			expect(frame).not.toContain("unreviewed");
		});

		it("renders no badge when the intent spec of the dir has no alignment", () => {
			const frame = renderRows([dirRow("src/cli")]);
			expect(frame).toContain("src/cli/");
			expect(frame).not.toContain("aligned]");
		});
	});
});
