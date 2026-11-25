import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { FileChipModel } from "@/observer/page/types/index.js";

/** One file chip, a button that opens its file: its glyph and file name, then the value in bold (`plan.aide · approved` `3/9`, `todo.aide` `2 open of 4`). */
export default function FileChip({ chip, onOpen }: { chip: FileChipModel; onOpen(): void }) {
	return (
		<button type="button" className={joinClasses("av-chip", "av-chip-btn", chip.tone)} title={`Open ${chip.file}`} onClick={onOpen}>
			<Icon name={chip.icon} />
			{chip.key}
			{chip.value !== null && (
				<>
					{" "}
					<b>{chip.value}</b>
				</>
			)}
		</button>
	);
}
