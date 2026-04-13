import React from "react";
import { Box, Text } from "ink";
import type { FlatNode } from "@/cli/flattenTree/index.js";

/** Type-tag display labels keyed by AideFileType. */
const TYPE_TAG: Record<string, string> = {
	intent: "intent",
	research: "research",
	plan: "plan",
	todo: "todo",
};

/** Type-tag colors keyed by AideFileType. */
const TYPE_COLOR: Record<string, string> = {
	intent: "cyan",
	research: "yellow",
	plan: "blue",
	todo: "magenta",
};

interface TreePanelProps {
	/** Pre-filtered visible nodes computed by App (single source of truth). */
	visibleNodes: FlatNode[];
	cursorIndex: number;
	searchFilter: string;
	isDeepView: boolean;
	/** Set of dir paths that are currently expanded. */
	expandedDirs: Set<string>;
	/** True when the cursor is currently on a dir node. */
	cursorOnDir: boolean;
	/** True when the cursor is on a dir node that is currently expanded. */
	cursorDirExpanded: boolean;
}

/** Render one flat node row in the tree. */
function renderRow(
	flatNode: FlatNode,
	index: number,
	cursorIndex: number,
	isDeepView: boolean,
	expandedDirs: Set<string>,
): React.ReactNode {
	const { node, depth } = flatNode;
	const isCursor = index === cursorIndex;
	const indent = "  ".repeat(depth);

	if (node.kind === "dir") {
		const label = node.path === "." ? ". /" : `${node.path}/`;
		const expandIndicator = expandedDirs.has(node.path) ? "v " : "> ";
		return (
			<Box key={`dir-${node.path}-${index}`}>
				<Text bold={isCursor} color={isCursor ? "white" : "gray"}>
					{indent}
					{expandIndicator}
					{label}
				</Text>
			</Box>
		);
	}

	// File node
	const { file } = node;
	const filename = file.relativePath.split("/").pop() ?? file.relativePath;
	const connector = "└── ";
	const tag = TYPE_TAG[file.type] ?? file.type;
	const tagColor = TYPE_COLOR[file.type] ?? "white";

	// Summaries are only shown in deep view, even if the file has one cached.
	const summary = isDeepView && file.summary ? ` — ${file.summary}` : "";

	return (
		<Box key={`file-${file.relativePath}-${index}`}>
			<Text bold={isCursor} backgroundColor={isCursor ? "blue" : undefined}>
				{indent}
				{connector}
			</Text>
			<Text bold={isCursor} backgroundColor={isCursor ? "blue" : undefined}>
				{filename}{" "}
			</Text>
			<Text color={tagColor} backgroundColor={isCursor ? "blue" : undefined}>
				[{tag}]
			</Text>
			{summary ? (
				<Text color="gray" backgroundColor={isCursor ? "blue" : undefined}>
					{summary}
				</Text>
			) : null}
		</Box>
	);
}

/**
 * Renders the left-panel tree of .aide files with cursor highlighting and optional summaries.
 * Receives pre-filtered visibleNodes from App — manages no state and performs no filtering.
 * Shows expand/collapse indicators on dir nodes and context-aware footer hints.
 */
export default function TreePanel({
	visibleNodes,
	cursorIndex,
	searchFilter,
	isDeepView,
	expandedDirs,
	cursorOnDir,
	cursorDirExpanded,
}: TreePanelProps): React.ReactElement {
	let hintText: string;
	if (cursorOnDir) {
		const escClear = searchFilter ? "  [esc] clear" : "";
		hintText = cursorDirExpanded
			? `${escClear}  [↑↓] navigate  [enter] collapse  [tab] deep view`
			: `${escClear}  [↑↓] navigate  [enter] expand  [tab] deep view`;
	} else if (searchFilter) {
		hintText = "  [esc] clear  [↑↓] navigate  [enter] drill in";
	} else {
		hintText = "  [↑↓] navigate  [enter] drill in  [tab] deep view";
	}

	return (
		<Box flexDirection="column" flexGrow={1}>
			{visibleNodes.length === 0 ? (
				<Text color="gray">  No results for "{searchFilter}"</Text>
			) : (
				visibleNodes.map((fn, i) => renderRow(fn, i, cursorIndex, isDeepView, expandedDirs))
			)}
			<Box marginTop={1}>
				<Text color="gray">{hintText}</Text>
			</Box>
		</Box>
	);
}
