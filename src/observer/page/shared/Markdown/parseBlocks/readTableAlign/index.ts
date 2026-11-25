import type { TableAlign } from "@/observer/page/types/index.js";

const DELIMITER = /^:?-+:?$/;

/**
 * Reads a GFM delimiter row's cells (`---`, `:--`, `--:`, `:-:`) as column alignments, or returns null
 * when any cell is not a delimiter, so the line before it is not a table header.
 */
export default function readTableAlign(cells: string[]): TableAlign[] | null {
	if (cells.length === 0 || !cells.every((cell) => DELIMITER.test(cell))) return null;
	return cells.map((cell) => {
		const left = cell.startsWith(":");
		const right = cell.endsWith(":");
		if (left && right) return "center";
		if (right) return "right";
		if (left) return "left";
		return null;
	});
}
