import React from "react";
import { Box, Text } from "ink";
import parseTodoItems from "./parseTodoItems/index.js";

interface RenderTodoDetailProps {
	/** Frontmatter description field, shown as the preview summary. */
	description: string;
	/** Raw body content of the todo file. */
	body: string;
	/** Controls which rendering mode is active. */
	mode: "preview" | "drill-in";
	/** File path, used as the drill-in panel title. */
	filePath: string;
}

/**
 * Renders a todo.aide file in preview mode (summary counts) or drill-in mode
 * (full issue list with misalignment annotations highlighted and completion state).
 */
export default function RenderTodoDetail({
	description,
	body,
	mode,
	filePath,
}: RenderTodoDetailProps): React.ReactElement {
	const items = parseTodoItems(body);
	const totalCount = items.length;
	const doneCount = items.filter((item) => item.done).length;
	const openCount = totalCount - doneCount;
	const misalignmentCount = items.filter((item) => item.misalignment !== undefined).length;

	if (mode === "preview") {
		return (
			<Box flexDirection="column" paddingX={2} paddingY={1}>
				{description ? (
					<Box marginBottom={1}>
						<Text wrap="wrap">{description}</Text>
					</Box>
				) : null}
				<Text>
					Issues:{" "}
					<Text color={openCount > 0 ? "yellow" : "green"}>
						{openCount} open
					</Text>
					{", "}
					<Text color="green">{doneCount} resolved</Text>
					{" ("}
					<Text>{totalCount} total</Text>
					{")"}
				</Text>
				{misalignmentCount > 0 && (
					<Box marginTop={1}>
						<Text color="red">⚑ {misalignmentCount} misalignment annotation{misalignmentCount !== 1 ? "s" : ""}</Text>
					</Box>
				)}
				<Box marginTop={1}>
					<Text color="gray">[↑↓] navigate  [enter] drill in  [tab] deep view</Text>
				</Box>
			</Box>
		);
	}

	// Drill-in mode — full issue list
	return (
		<Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
			{/* Panel title */}
			<Text bold>{filePath}</Text>

			{/* Completion summary */}
			<Box marginTop={1}>
				<Text>
					Issues:{" "}
					<Text color={openCount > 0 ? "yellow" : "green"}>
						{openCount} open
					</Text>
					{", "}
					<Text color="green">{doneCount} resolved</Text>
					{" ("}
					<Text>{totalCount} total</Text>
					{")"}
				</Text>
			</Box>

			{/* Issue list */}
			{items.length === 0 ? (
				<Box marginTop={1}>
					<Text color="gray">No checklist items found.</Text>
				</Box>
			) : (
				<Box flexDirection="column" marginTop={1}>
					{items.map((item, i) => (
						<Box key={i} flexDirection="column" marginBottom={1}>
							<Box flexDirection="row">
								{/* Checkbox state */}
								{item.done ? (
									<Text color="green">✓ </Text>
								) : (
									<Text color="gray">○ </Text>
								)}
								{/* Item text — yellow/red when misalignment annotation present */}
								<Box flexGrow={1}>
									<Text
										color={item.misalignment !== undefined ? "yellow" : undefined}
										wrap="wrap"
									>
										{item.text}
									</Text>
								</Box>
							</Box>
							{/* Misalignment annotation */}
							{item.misalignment !== undefined && (
								<Box marginLeft={2}>
									<Text color="red">⚑ Misalignment: {item.misalignment}</Text>
								</Box>
							)}
						</Box>
					))}
				</Box>
			)}

			{/* Footer */}
			<Box marginTop={1}>
				<Text color="gray">[esc] back  [e] open in editor</Text>
			</Box>
		</Box>
	);
}
