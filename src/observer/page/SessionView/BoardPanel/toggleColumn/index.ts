import type { BoardColumnId } from "@/types/index.js";

/** The set of columns showing every task with `column` flipped: expanded if it was capped, capped if it was expanded. The input is left as it was. */
export default function toggleColumn({ expanded, column }: { expanded: ReadonlySet<BoardColumnId>; column: BoardColumnId }): ReadonlySet<BoardColumnId> {
	const next = new Set(expanded);
	if (!next.delete(column)) next.add(column);
	return next;
}
