import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import type { FileChipModel } from "@/observer/page/types/index.js";

/** One file chip: its glyph and key, then the value in bold (`plan · approved` `3/9`, `todo` `2 open of 4`). */
export default function FileChip({ chip }: { chip: FileChipModel }) {
	return (
		<span className={joinClasses("av-chip", chip.tone)}>
			<Icon name={chip.icon} />
			{chip.key}
			{chip.value !== null && (
				<>
					{" "}
					<b>{chip.value}</b>
				</>
			)}
		</span>
	);
}
