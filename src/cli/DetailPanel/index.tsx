import React from "react";
import { Box, Text } from "ink";
import type { AideFile, AideFrontmatter } from "@/types/index.js";

interface DetailPanelProps {
	file: AideFile | null;
	frontmatter: AideFrontmatter | null;
}

/** Truncate a string to maxLen chars, appending "..." if trimmed. */
function truncate(s: string, maxLen: number): string {
	if (s.length <= maxLen) return s;
	return s.slice(0, maxLen - 3) + "...";
}

/**
 * Right-panel preview in tree mode. Shows scope, truncated intent, and outcome counts
 * for the currently selected file. Shows a welcome hint when no file is selected.
 */
export default function DetailPanel({ file, frontmatter }: DetailPanelProps): React.ReactElement {
	if (!file || !frontmatter) {
		return (
			<Box flexDirection="column" paddingX={2} paddingY={1}>
				<Text color="gray">Select a file to preview</Text>
				<Box marginTop={1}>
					<Text color="gray">Type to search, [tab] for deep view</Text>
				</Box>
			</Box>
		);
	}

	const scope = frontmatter.scope ?? "(no scope)";
	const intent = frontmatter.intent ? truncate(frontmatter.intent, 160) : "(no intent)";
	const desiredCount = frontmatter.outcomes?.desired.length ?? 0;
	const undesiredCount = frontmatter.outcomes?.undesired.length ?? 0;

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1}>
			<Text bold>scope: {scope}</Text>
			<Box marginTop={1}>
				<Text wrap="wrap">{intent}</Text>
			</Box>
			{(desiredCount > 0 || undesiredCount > 0) && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="green">✓ desired ({desiredCount})</Text>
					<Text color="red">✗ undesired ({undesiredCount})</Text>
				</Box>
			)}
		</Box>
	);
}
