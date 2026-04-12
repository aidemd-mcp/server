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
}

/** Render one flat node row in the tree. */
function renderRow(flatNode: FlatNode, index: number, cursorIndex: number, isDeepView: boolean): React.ReactNode {
	const { node, depth } = flatNode;
	const isCursor = index === cursorIndex;
	const indent = "  ".repeat(depth);

	if (node.kind === "dir") {
		const label = node.path === "." ? ". /" : `${node.path}/`;
		return (
			<Box key={`dir-${node.path}-${index}`}>
				<Text bold={isCursor} color={isCursor ? "white" : "gray"}>
					{indent}
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
 */
export default function TreePanel({ visibleNodes, cursorIndex, searchFilter, isDeepView }: TreePanelProps): React.ReactElement {
	return (
		<Box flexDirection="column" flexGrow={1}>
			{visibleNodes.length === 0 ? (
				<Text color="gray">  No results for "{searchFilter}"</Text>
			) : (
				visibleNodes.map((fn, i) => renderRow(fn, i, cursorIndex, isDeepView))
			)}
			<Box marginTop={1}>
				<Text color="gray">
					{searchFilter
						? `  [esc] clear  [↑↓] navigate  [enter] drill in`
						: `  [↑↓] navigate  [enter] drill in  [tab] deep view`}
				</Text>
			</Box>
		</Box>
	);
}
