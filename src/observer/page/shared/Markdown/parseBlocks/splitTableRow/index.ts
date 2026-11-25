/**
 * Splits one GFM table row into its trimmed cells, or returns null when the line is not a row (no
 * unescaped `|`). Leading and trailing pipes are optional; `\|` is a literal pipe inside a cell.
 */
export default function splitTableRow(line: string): string[] | null {
	const cells: string[] = [];
	let cell = "";
	let pipes = 0;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (char === "\\" && line[index + 1] === "|") {
			cell += "|";
			index += 1;
		} else if (char === "|") {
			cells.push(cell);
			cell = "";
			pipes += 1;
		} else cell += char;
	}
	cells.push(cell);
	if (pipes === 0) return null;

	// A pipe at either end opens or closes the row; it adds no empty cell.
	const trimmed = line.trim();
	if (trimmed.startsWith("|")) cells.shift();
	if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) cells.pop();
	return cells.map((value) => value.trim());
}
