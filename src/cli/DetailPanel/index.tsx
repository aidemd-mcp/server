import React from "react";
import { Box, Text, useStdout } from "ink";
import type { AideFile, AideFrontmatter, BodySection } from "@/types/index.js";
import RenderPlanDetail from "./renderPlanDetail/index.js";
import RenderTodoDetail from "./renderTodoDetail/index.js";

interface DetailPanelProps {
	file: AideFile | null;
	frontmatter: AideFrontmatter | null;
	/** Raw body content of the selected or drilled-in file. Used by plan/todo renderers. */
	body: string;
	/** Controls which rendering mode is active in the right panel. */
	mode: "preview" | "drill-in";
	/** Body sections from the drilled-in file. */
	sections: BodySection[];
	/** Index of the currently expanded section, or null when all are collapsed. */
	expandedSection: number | null;
	/** File path shown as the panel title during drill-in, or null in preview mode. */
	drilledFilePath: string | null;
}

/** Truncate a string to maxLen chars, appending "..." if trimmed. */
function truncate(s: string, maxLen: number): string {
	if (s.length <= maxLen) return s;
	return s.slice(0, maxLen - 3) + "...";
}

/** Bullet-point list of outcome strings. */
function OutcomeList({ items, color }: { items: string[]; color: string }): React.ReactElement {
	return (
		<Box flexDirection="column">
			{items.map((item, i) => (
				<Box key={i} flexDirection="row">
					<Text color={color}>• </Text>
					<Box flexGrow={1}>
						<Text wrap="wrap">{item}</Text>
					</Box>
				</Box>
			))}
		</Box>
	);
}

/** Side-by-side (or stacked) outcomes display. */
function OutcomesDisplay({
	desired,
	undesired,
	wide,
}: {
	desired: string[];
	undesired: string[];
	wide: boolean;
}): React.ReactElement {
	if (wide) {
		return (
			<Box flexDirection="row" marginTop={1}>
				<Box
					flexDirection="column"
					flexBasis="50%"
					borderStyle="single"
					borderColor="green"
					paddingX={1}
					marginRight={1}
				>
					<Text bold color="green">
						Desired Outcomes
					</Text>
					<Box marginTop={1}>
						<OutcomeList items={desired} color="green" />
					</Box>
				</Box>
				<Box
					flexDirection="column"
					flexBasis="50%"
					borderStyle="single"
					borderColor="red"
					paddingX={1}
				>
					<Text bold color="red">
						Undesired Outcomes
					</Text>
					<Box marginTop={1}>
						<OutcomeList items={undesired} color="red" />
					</Box>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" marginTop={1}>
			<Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1} marginBottom={1}>
				<Text bold color="green">
					Desired Outcomes
				</Text>
				<Box marginTop={1}>
					<OutcomeList items={desired} color="green" />
				</Box>
			</Box>
			<Box flexDirection="column" borderStyle="single" borderColor="red" paddingX={1}>
				<Text bold color="red">
					Undesired Outcomes
				</Text>
				<Box marginTop={1}>
					<OutcomeList items={undesired} color="red" />
				</Box>
			</Box>
		</Box>
	);
}

/**
 * Right-panel component that handles both preview mode (tree navigation) and
 * drill-in mode (formatted frontmatter card with expandable body sections).
 *
 * Delegates to RenderPlanDetail for plan files and RenderTodoDetail for todo files.
 * Intent and research files use the intent-card layout (scope, intent, outcomes).
 *
 * In preview mode: scope, truncated intent, and outcome counts (or plan/todo summary).
 * In drill-in mode: full frontmatter card or plan/todo detail view.
 */
export default function DetailPanel({
	file,
	frontmatter,
	body,
	mode,
	sections,
	expandedSection,
	drilledFilePath,
}: DetailPanelProps): React.ReactElement {
	const { stdout } = useStdout();
	const columns = stdout?.columns ?? 80;
	const wide = columns >= 80;

	// --- Preview mode ---
	if (mode === "preview") {
		if (!file) {
			return (
				<Box flexDirection="column" paddingX={2} paddingY={1}>
					<Text color="gray">Select a file to preview</Text>
					<Box marginTop={1}>
						<Text color="gray">Type to search, [tab] for deep view</Text>
					</Box>
				</Box>
			);
		}

		// Delegate to type-specific renderers for plan and todo files.
		if (file.type === "plan") {
			return <RenderPlanDetail file={file} frontmatter={frontmatter} mode="preview" body={body} drilledFilePath={null} />;
		}
		if (file.type === "todo") {
			const description = frontmatter?.description ?? file.description ?? "";
			return <RenderTodoDetail description={description} body={body} mode="preview" filePath={file.relativePath} />;
		}

		if (!frontmatter) {
			return (
				<Box flexDirection="column" paddingX={2} paddingY={1}>
					<Text color="red">[FAILED TO PARSE]</Text>
					<Box marginTop={1}>
						<Text color="gray">{file.relativePath}</Text>
					</Box>
				</Box>
			);
		}

		const scope = frontmatter.scope ?? "[FAILED TO PARSE]";
		const intent = frontmatter.intent ? truncate(frontmatter.intent, 160) : "[FAILED TO PARSE]";
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
				<Box marginTop={1}>
					<Text color="gray">[↑↓] navigate  [enter] drill in  [tab] deep view</Text>
				</Box>
			</Box>
		);
	}

	// --- Drill-in mode ---

	// Delegate to type-specific renderers for plan and todo files.
	if (file?.type === "plan") {
		return <RenderPlanDetail file={file} frontmatter={frontmatter} mode="drill-in" body={body} drilledFilePath={drilledFilePath} />;
	}
	if (file?.type === "todo") {
		const description = frontmatter?.description ?? file?.description ?? "";
		return <RenderTodoDetail description={description} body={body} mode="drill-in" filePath={drilledFilePath ?? file?.relativePath ?? ""} />;
	}

	const title = drilledFilePath ?? "[unknown]";
	const scope = frontmatter?.scope ?? "[FAILED TO PARSE]";
	const intent = frontmatter?.intent ?? "[FAILED TO PARSE]";
	const desired = frontmatter?.outcomes?.desired ?? [];
	const undesired = frontmatter?.outcomes?.undesired ?? [];

	const visibleSections = sections.filter((s) => s.heading !== "");

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
			{/* Panel title — drilled file path */}
			<Text bold>{title}</Text>

			{/* Scope heading */}
			<Box marginTop={1}>
				<Text bold>scope: </Text>
				<Text>{scope}</Text>
			</Box>

			{/* Full intent paragraph — not truncated */}
			<Box marginTop={1}>
				<Text wrap="wrap">{intent}</Text>
			</Box>

			{/* Outcomes — side-by-side or stacked */}
			{(desired.length > 0 || undesired.length > 0) && (
				<OutcomesDisplay desired={desired} undesired={undesired} wide={wide} />
			)}

			{/* Body sections — only one expanded at a time via expandedSection */}
			{visibleSections.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					{visibleSections.map((section, i) => {
						const isExpanded = i === expandedSection;
						return (
							<Box key={i} flexDirection="column" marginBottom={1}>
								<Text>
									{isExpanded ? "▾" : "▸"} {section.heading}
									{!isExpanded && section.summary ? ` (${section.summary})` : ""}
								</Text>
								{isExpanded && (
									<Box marginLeft={2} marginTop={1}>
										<Text wrap="wrap">{section.content}</Text>
									</Box>
								)}
							</Box>
						);
					})}
				</Box>
			)}

			{/* Drill-in footer */}
			<Box marginTop={1}>
				<Text color="gray">[esc] back  [tab] next section  [e] open in editor</Text>
			</Box>
		</Box>
	);
}
