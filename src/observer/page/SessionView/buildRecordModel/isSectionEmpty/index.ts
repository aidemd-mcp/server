import type { PresentSessionRecord } from "@/observer/page/types/index.js";

/** Whether a section holds no text at all, in its own markdown or in any `###` subsection. */
export default function isSectionEmpty(section: PresentSessionRecord["sections"][number]): boolean {
	return section.markdown.trim() === "" && section.subsections.every((subsection) => subsection.markdown.trim() === "");
}
