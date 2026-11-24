import type { SessionRecord } from "@/types/index.js";
import type { RecordModel, RecordOutlineEntry, RecordSection } from "@/observer/page/types/index.js";
import countListItems from "./countListItems/index.js";
import emptyText from "./emptyText/index.js";
import isSectionEmpty from "./isSectionEmpty/index.js";
import isStopHeading from "./isStopHeading/index.js";

/**
 * What the Record tab draws, from the observer's session record. A missing or unreadable record is
 * just its message. A present one keeps every `##` section in file order under the id `rec-<index>`
 * (the index is the section's place in the file, so two equal headings stay distinct); the first
 * "Where this cycle stopped" section is lifted out as the pinned one and listed first in the outline.
 * An outline count is the section's list items with its subsections' as text, blank when there are
 * none and for the pinned section; a section with no text carries the calm text to show instead.
 */
export default function buildRecordModel({ record }: { record: SessionRecord }): RecordModel {
	if (record.state === "missing") {
		return { kind: "missing", message: ".aide/session.aide isn't there yet; it appears once the agent writes it." };
	}
	if (record.state === "unreadable") return { kind: "unreadable", message: record.error };

	const stopIndex = record.sections.findIndex((section) => isStopHeading(section.heading));
	const sections: RecordSection[] = record.sections.map((section, index) => ({
		id: `rec-${index}`,
		heading: section.heading,
		markdown: section.markdown,
		subsections: section.subsections,
		empty: isSectionEmpty(section) ? emptyText(section.heading) : null,
	}));
	const entries: RecordOutlineEntry[] = record.sections.map((source, index) => {
		const items = countListItems(source.markdown) + source.subsections.reduce((sum, subsection) => sum + countListItems(subsection.markdown), 0);
		const pinned = index === stopIndex;
		return { id: `rec-${index}`, label: source.heading, pinned, count: pinned || items === 0 ? "" : String(items) };
	});

	return {
		kind: "present",
		outline: [...entries.filter((entry) => entry.pinned), ...entries.filter((entry) => !entry.pinned)],
		pinned: stopIndex === -1 ? null : sections[stopIndex],
		sections: sections.filter((_, index) => index !== stopIndex),
	};
}
