import countMarker from "./countMarker/index.js";

const START_MARKER = "<!-- aide-tools:start -->";
const END_MARKER = "<!-- aide-tools:end -->";

/**
 * Replaces the text between the README's aide-tools markers with `lines`, one per row.
 *
 * The README outside the markers is hand-owned and must survive every run
 * unchanged, so everything up to and including the start marker and everything
 * from the end marker on is copied byte for byte. Anything wrong with the
 * markers throws instead of falling back, because a guess could overwrite
 * hand-written text. The line ending is CRLF when the README already uses it,
 * LF otherwise, so a run never mixes endings.
 */
export default function spliceSection({ readme, lines }: { readme: string; lines: string[] }): string {
	const startCount = countMarker({ readme, marker: START_MARKER });
	const endCount = countMarker({ readme, marker: END_MARKER });
	if (startCount === 0) throw new Error(`README tools section: marker "${START_MARKER}" is missing; expected exactly 1`);
	if (endCount === 0) throw new Error(`README tools section: marker "${END_MARKER}" is missing; expected exactly 1`);
	if (startCount > 1) {
		throw new Error(`README tools section: marker "${START_MARKER}" appears ${startCount} times; expected exactly 1`);
	}
	if (endCount > 1) {
		throw new Error(`README tools section: marker "${END_MARKER}" appears ${endCount} times; expected exactly 1`);
	}

	const startIndex = readme.indexOf(START_MARKER);
	const endIndex = readme.indexOf(END_MARKER);
	if (endIndex < startIndex) {
		throw new Error(`README tools section: marker "${END_MARKER}" appears before marker "${START_MARKER}"`);
	}

	const eol = readme.includes("\r\n") ? "\r\n" : "\n";
	const head = readme.slice(0, startIndex + START_MARKER.length);
	const tail = readme.slice(endIndex);
	// With zero lines the inside is a single EOL, so the markers stay on separate rows.
	const inside = lines.length === 0 ? eol : `${eol}${lines.join(eol)}${eol}`;
	return `${head}${inside}${tail}`;
}
