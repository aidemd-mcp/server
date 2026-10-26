import type { ReleaseNoteBullet, ReleaseNoteHeading } from "@/types/index.js";

const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\]/;
const SECTION_HEADING_PREFIX = "## ";
const HIGHLIGHT_SUBSECTION = /^### (Added|Fixed|Changed)\s*$/;
const SUBSECTION_HEADING_PREFIX = "### ";
const BULLET_PREFIX = "- ";
const MIGRATION_TAG = "[migration]";

/**
 * Lifts the highlight candidates out of a Keep a Changelog file: top-level
 * bullets under a released version's Added, Fixed or Changed subsection.
 * `[migration]` bullets, sub-bullets, `[Unreleased]` entries and other
 * subsections are never candidates. Pure, never throws; results are in
 * document order.
 */
export default function readReleaseBullets(
	changelog: string,
): ReleaseNoteBullet[] {
	const bullets: ReleaseNoteBullet[] = [];
	let version: string | null = null;
	let heading: ReleaseNoteHeading | null = null;

	for (const rawLine of changelog.split("\n")) {
		const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

		const versionMatch = VERSION_HEADING.exec(line);
		if (versionMatch) {
			version = versionMatch[1];
			heading = null;
			continue;
		}
		if (line.startsWith(SECTION_HEADING_PREFIX)) {
			version = null;
			heading = null;
			continue;
		}

		const headingMatch = HIGHLIGHT_SUBSECTION.exec(line);
		if (headingMatch) {
			heading = headingMatch[1] as ReleaseNoteHeading;
			continue;
		}
		if (line.startsWith(SUBSECTION_HEADING_PREFIX)) {
			heading = null;
			continue;
		}

		if (!version || !heading) continue;
		if (!line.startsWith(BULLET_PREFIX)) continue;

		const text = line.slice(BULLET_PREFIX.length).trim();
		if (text.startsWith(MIGRATION_TAG)) continue;
		bullets.push({ version, heading, text });
	}

	return bullets;
}
