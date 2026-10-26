const MAX_HIGHLIGHT_LENGTH = 120;
const BOLD_MARKER = /\*\*/g;
const WHITESPACE_RUN = /\s+/g;
const SENTENCE_END = /\.(?= [A-Z])/;
const ELLIPSIS = "…";

/**
 * Turns one changelog bullet into a line a user reads at a glance: its first
 * sentence, capped, because a notice that pastes whole entries gets scrolled
 * past.
 */
export default function toOneLine(text: string): string {
	const flattened = text
		.replace(BOLD_MARKER, "")
		.replace(WHITESPACE_RUN, " ")
		.trim();

	const sentenceEnd = flattened.search(SENTENCE_END);
	const sentence =
		sentenceEnd === -1 ? flattened : flattened.slice(0, sentenceEnd + 1);
	if (sentence.length <= MAX_HIGHLIGHT_LENGTH) return sentence;

	const room = MAX_HIGHLIGHT_LENGTH - 1;
	const lastSpace = sentence.lastIndexOf(" ", room);
	const cut = lastSpace > 0 ? lastSpace : room;
	return sentence.slice(0, cut).trimEnd() + ELLIPSIS;
}
