/**
 * Appends one line to a text file's contents, keeping every existing byte. The
 * line ends in the file's own line ending (`\r\n` when the text holds one,
 * else `\n`); a final line without a newline gets one first. Null or empty
 * text yields just the line.
 */
export default function appendLine(input: { text: string | null; line: string }): string {
	const { text, line } = input;
	if (text === null || text === "") return `${line}\n`;
	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	const separator = text.endsWith("\n") ? "" : eol;
	return `${text}${separator}${line}${eol}`;
}
