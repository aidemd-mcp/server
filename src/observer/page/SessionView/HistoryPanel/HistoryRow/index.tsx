import Icon from "@/observer/page/shared/Icon/index.js";
import type { HistoryRowModel } from "@/observer/page/types/index.js";

/**
 * One line of the history: the time, the glyph with its screen-reader word, the label with its mono
 * part, session tag and meta line. A row that opens something is a button; one with nothing to open
 * (a standalone group of file writes) draws the same grid as a plain block. `showSession` prints
 * the session tag while two sessions share the history.
 */
export default function HistoryRow({ row, showSession, onOpen }: { row: HistoryRowModel; showSession: boolean; onOpen(): void }) {
	const className = row.kind === "sub" ? "av-hrow sub" : `av-hrow k-${row.kind}`;
	const content = (
		<>
			<span className="h-t">{row.time}</span>
			<span className="h-g">
				<Icon name={row.icon} />
				<span className="sr">{row.kindWord}</span>
			</span>
			<span className="h-l">
				{row.label}
				{row.mono !== null && (
					<>
						{" "}
						<span className="mono">{row.mono}</span>
					</>
				)}
				{showSession && row.sessionTag !== null && <span className="av-hsess">{row.sessionTag}</span>}
				{row.meta !== null && <span className="h-m">{row.meta}</span>}
			</span>
		</>
	);
	if (row.item === null) return <div className={className}>{content}</div>;
	return (
		<button type="button" className={className} onClick={onOpen}>
			{content}
		</button>
	);
}
