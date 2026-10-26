import type { ReleaseNoteHeading } from "@/types/index.js";
import readReleaseBullets from "./readReleaseBullets/index.js";
import toOneLine from "./toOneLine/index.js";

const HEADING_RANK: ReleaseNoteHeading[] = ["Added", "Fixed", "Changed"];
const MAX_HIGHLIGHTS = 3;

/**
 * Picks the few lines worth showing from the releases the user skipped,
 * favouring additions and fixes over changes, and newer releases over older
 * ones. Returns at most three one-line highlights; `[]` when nothing
 * qualifies. Pure, never throws.
 */
export default function pickHighlights(changelog: string, skipped: string[]): string[] {
	// 1. Read the candidate bullets out of the changelog
	const bullets = readReleaseBullets(changelog);

	// 2. Keep only those from releases the user skipped
	const fromSkipped = bullets.filter((bullet) => skipped.includes(bullet.version));

	// 3. Order by heading rank, then newest skipped release first (stable: document order breaks ties)
	const ordered = [...fromSkipped].sort(
		(a, b) =>
			HEADING_RANK.indexOf(a.heading) - HEADING_RANK.indexOf(b.heading) ||
			skipped.indexOf(a.version) - skipped.indexOf(b.version),
	);

	// 4. Take the first few and reduce each to one line
	return ordered.slice(0, MAX_HIGHLIGHTS).map((bullet) => toOneLine(bullet.text));
}
