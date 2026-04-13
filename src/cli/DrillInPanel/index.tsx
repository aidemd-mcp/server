import React from "react";
import { Box, Text, useStdout } from "ink";
import type { AideFrontmatter, BodySection } from "@/types/index.js";

interface DrillInPanelProps {
	/** Path label shown in the panel title. */
	label: string;
	frontmatter: AideFrontmatter | null;
	sections: BodySection[];
	/** Index of the currently focused body section (for keyboard expand/collapse). */
	focusedSection: number;
	/** Set of expanded section indices. */
	expanded: Set<number>;
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
 * Full formatted drill-in view for a single .aide file.
 * Renders: scope, intent paragraph, side-by-side outcomes, collapsible body sections.
 * All interactive state (focusedSection, expanded) is lifted to App and passed as props.
 */
export default function DrillInPanel({ label, frontmatter, sections, focusedSection, expanded }: DrillInPanelProps): React.ReactElement {
	const { stdout } = useStdout();
	const columns = stdout?.columns ?? 80;
	const wide = columns >= 80;

	const scope = frontmatter?.scope ?? "[FAILED TO PARSE]";
	const intent = frontmatter?.intent ?? "[FAILED TO PARSE]";
	const desired = frontmatter?.outcomes?.desired ?? [];
	const undesired = frontmatter?.outcomes?.undesired ?? [];

	const visibleSections = sections.filter((s) => s.heading !== "");

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1} flexGrow={1}>
			{/* Title */}
			<Text bold>{label}</Text>

			{/* Scope */}
			<Box marginTop={1}>
				<Text bold>scope: </Text>
				<Text>{scope}</Text>
			</Box>

			{/* Intent paragraph */}
			<Box marginTop={1}>
				<Text wrap="wrap">{intent}</Text>
			</Box>

			{/* Outcomes — side-by-side or stacked */}
			{(desired.length > 0 || undesired.length > 0) && (
				<OutcomesDisplay desired={desired} undesired={undesired} wide={wide} />
			)}

			{/* Body sections — collapsed by default, focused section highlighted */}
			{visibleSections.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					{visibleSections.map((section, i) => {
						const isExpanded = expanded.has(i);
						const isFocused = i === focusedSection;
						return (
							<Box key={i} flexDirection="column" marginBottom={1}>
								<Text bold={isFocused} color={isFocused ? "cyan" : undefined}>
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

			{/* Footer hint */}
			<Box marginTop={1}>
				<Text color="gray">[esc] back  [↑↓] scroll  [enter] expand section</Text>
			</Box>
		</Box>
	);
}
