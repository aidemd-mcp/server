import React from "react";
import { Box, Text } from "ink";
import type { AideFile, AideFrontmatter } from "@/types/index.js";
import parsePlanItems from "./parsePlanItems/index.js";

interface RenderPlanDetailProps {
	file: AideFile;
	frontmatter: AideFrontmatter | null;
	/** Controls which rendering mode is active in the right panel. */
	mode: "preview" | "drill-in";
	/** Raw body content of the plan file. */
	body: string;
	/** File path shown as the panel title during drill-in, or null in preview mode. */
	drilledFilePath: string | null;
}

/** Renders a compact ASCII progress bar of fixed width. */
function ProgressBar({ done, total, width }: { done: number; total: number; width: number }): React.ReactElement {
	const filled = total > 0 ? Math.round((done / total) * width) : 0;
	const bar = "█".repeat(filled) + "░".repeat(width - filled);
	return <Text color="cyan">[{bar}]</Text>;
}

/**
 * Detail panel renderer for plan files (.aide files of type "plan").
 *
 * Preview mode: description from frontmatter, progress fraction, remaining count.
 * Drill-in mode: grouped checklist items by step heading, completion summary at top.
 */
export default function RenderPlanDetail({
	file,
	frontmatter,
	mode,
	body,
	drilledFilePath,
}: RenderPlanDetailProps): React.ReactElement {
	const steps = parsePlanItems(body);

	const allItems = steps.flatMap((s) => s.items);
	const doneCount = allItems.filter((i) => i.done).length;
	const totalCount = allItems.length;
	const remainingCount = totalCount - doneCount;

	// --- Preview mode ---
	if (mode === "preview") {
		const description = frontmatter?.description ?? file.description ?? "";

		return (
			<Box flexDirection="column" paddingX={2} paddingY={1}>
				{description !== "" && (
					<Box marginBottom={1}>
						<Text wrap="wrap">{description}</Text>
					</Box>
				)}
				<Box flexDirection="row" gap={1} alignItems="center">
					<ProgressBar done={doneCount} total={totalCount} width={20} />
					<Text>
						{doneCount}/{totalCount} complete
					</Text>
				</Box>
				{remainingCount > 0 && (
					<Box marginTop={1}>
						<Text color="gray">{remainingCount} item{remainingCount !== 1 ? "s" : ""} remaining</Text>
					</Box>
				)}
				<Box marginTop={1}>
					<Text color="gray">[↑↓] navigate  [enter] drill in  [tab] deep view</Text>
				</Box>
			</Box>
		);
	}

	// --- Drill-in mode ---
	const title = drilledFilePath ?? file.relativePath;

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
			{/* Panel title */}
			<Text bold>{title}</Text>

			{/* Completion summary */}
			<Box marginTop={1}>
				<Text bold color={doneCount === totalCount && totalCount > 0 ? "green" : "cyan"}>
					Progress: {doneCount}/{totalCount} step{totalCount !== 1 ? "s" : ""} complete
				</Text>
			</Box>

			{/* Step groups with checklist items */}
			{steps.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					{steps.map((s, si) => (
						<Box key={si} flexDirection="column" marginBottom={1}>
							{s.step !== "" && (
								<Text bold>{s.step}</Text>
							)}
							{s.items.map((item, ii) => (
								<Box key={ii} flexDirection="row" marginLeft={s.step !== "" ? 2 : 0}>
									{item.done ? (
										<Text color="green">✓ </Text>
									) : (
										<Text color="gray">○ </Text>
									)}
									<Box flexGrow={1}>
										<Text color={item.done ? "gray" : undefined} wrap="wrap">
											{item.text}
										</Text>
									</Box>
								</Box>
							))}
						</Box>
					))}
				</Box>
			)}

			{totalCount === 0 && (
				<Box marginTop={1}>
					<Text color="gray">No checklist items found.</Text>
				</Box>
			)}

			{/* Drill-in footer */}
			<Box marginTop={1}>
				<Text color="gray">[esc] back  [e] open in editor</Text>
			</Box>
		</Box>
	);
}
