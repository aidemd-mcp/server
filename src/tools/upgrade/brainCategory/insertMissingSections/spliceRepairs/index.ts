import type { BrainSectionRepair } from "@/types/index.js";
import locateFrontmatter from "../../shared/locateFrontmatter/index.js";
import toLineEnding from "../../shared/toLineEnding/index.js";

/**
 * Splices every repair block into the raw brain.aide text and returns the new text, touching no
 * existing byte: each repair only adds bytes at one offset (upgrade brief #15).
 *
 * Repairs apply in array order to the progressively updated text, so a repair anchored on the
 * close marker of a block inserted one step earlier finds it. A repair anchored on a close
 * marker lands directly after the first occurrence of that marker at or after the body start,
 * behind `eol + eol` (one blank line). A `null` anchor lands at the body start behind one
 * `eol`, followed by one `eol` (one extra leading `eol` when the closing fence was the last
 * line and has no break of its own). Blocks and separators are LF template text converted to
 * the file's line ending, so a CRLF file stays all-CRLF.
 *
 * Offsets come from the raw text (`locateFrontmatter`), never from parsed bodies, because
 * body extraction strips only a leading LF and would drift on CRLF files. Every insertion
 * lands at or after the body start, so the frontmatter offsets stay valid across repairs.
 *
 * @throws When a repair's `insertAfter` marker is absent from the text; the planner anchors
 *   only on markers it saw present, so that is a broken precondition, not a recoverable state.
 */
export default function spliceRepairs({
	raw,
	repairs,
	eol,
}: {
	raw: string;
	repairs: BrainSectionRepair[];
	eol: "\r\n" | "\n";
}): string {
	const { bodyStart } = locateFrontmatter(raw);

	return repairs.reduce((text, { block, insertAfter }) => {
		const converted = toLineEnding({ text: block, eol });

		if (insertAfter === null) {
			const leading = bodyStart === text.length ? eol : "";
			return text.slice(0, bodyStart) + leading + eol + converted + eol + text.slice(bodyStart);
		}

		const anchorStart = text.indexOf(insertAfter, bodyStart);
		if (anchorStart === -1) throw new Error(`spliceRepairs anchor ${insertAfter} is absent from the text`);

		const anchorEnd = anchorStart + insertAfter.length;
		return text.slice(0, anchorEnd) + eol + eol + converted + text.slice(anchorEnd);
	}, raw);
}
