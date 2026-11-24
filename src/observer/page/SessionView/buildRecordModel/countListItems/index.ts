/** The list items (`- ` or `N. ` lines) in a block of markdown. */
export default function countListItems(markdown: string): number {
	return markdown.split("\n").filter((line) => /^\s*(?:-|\d+\.)\s+\S/.test(line)).length;
}
