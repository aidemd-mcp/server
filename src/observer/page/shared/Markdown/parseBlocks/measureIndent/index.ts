/** How many columns a line's leading whitespace spans, a tab reaching the next multiple of four. Pure. */
export default function measureIndent(line: string): number {
	let columns = 0;
	for (const char of line) {
		if (char === "\t") columns += 4 - (columns % 4);
		else if (char === " ") columns += 1;
		else break;
	}
	return columns;
}
