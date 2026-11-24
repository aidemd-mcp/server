import { Fragment } from "react";
import Markdown from "@/observer/page/shared/Markdown/index.js";
import type { RecordSection } from "@/observer/page/types/index.js";

/**
 * What sits under a record section's heading: its markdown, each `###` subsection as an `h4` with
 * its own markdown, or the calm `.av-empty` line when the section holds nothing. Shared by the
 * pinned section and the plain ones, so both read the same.
 */
export default function RecordBody({ section }: { section: RecordSection }) {
	if (section.empty !== null) return <p className="av-empty">{section.empty}</p>;
	return (
		<>
			<Markdown markdown={section.markdown} />
			{section.subsections.map((subsection, index) => (
				<Fragment key={index}>
					<h4>{subsection.heading}</h4>
					<Markdown markdown={subsection.markdown} />
				</Fragment>
			))}
		</>
	);
}
