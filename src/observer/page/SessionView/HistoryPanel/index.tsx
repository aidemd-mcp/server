import { type ReactNode, useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import type { DrawerItem, HistoryModel, HistoryTypeFilter } from "@/observer/page/types/index.js";
import buildHistoryList from "./buildHistoryList/index.js";
import buildTypeChips from "./buildTypeChips/index.js";
import HistoryRow from "./HistoryRow/index.js";

/**
 * The History column (a tab on a phone): the event count, the order toggle, the session filter
 * (only while two sessions share the history), the type filters and the list. It owns the order, the
 * type and the session picked; the model comes oldest first and this panel orders and filters it.
 * A row opens its detail through `onOpen`.
 */
export default function HistoryPanel({
	history,
	onOpen,
	order,
	head,
}: {
	history: HistoryModel;
	onOpen(item: DrawerItem): void;
	/** Set by the desktop history drawer, which owns the order and draws no header or type filters. */
	order?: { newest: boolean };
	/** The drawer's pinned heading (session picker and order switch); the day labels then carry only the day. */
	head?: ReactNode;
}) {
	const [ownNewest, setNewest] = useState(true);
	const newest = order?.newest ?? ownNewest;
	const [type, setType] = useState<HistoryTypeFilter>("all");
	const [picked, setPicked] = useState("all");

	const showSession = history.sessions.length >= 2;
	const session = history.sessions.some((entry) => entry.id === picked) ? picked : "all";
	const list = buildHistoryList({ rows: history.rows, type, session, newest });
	const chips = buildTypeChips({ counts: history.counts });
	const sessionChips = [{ id: "all", label: "Both sessions" }, ...history.sessions];

	return (
		<aside className="av-side" aria-label="History">
			{head !== undefined && <div className="av-histhead">{head}</div>}
			{order === undefined && (
				<div className="av-hist-h">
					<h2 className="av-h2">
						<Icon name="history" />
						History <span className="n">{history.total === 1 ? "1 event" : `${history.total} events`}</span>
					</h2>
					<div className="av-seg" role="group" aria-label="Order">
						<button type="button" aria-pressed={newest} onClick={() => setNewest(true)}>
							Newest first
						</button>
						<button type="button" aria-pressed={!newest} onClick={() => setNewest(false)}>
							Oldest first
						</button>
					</div>
				</div>
			)}
			{showSession && (
				<div className="av-seg" role="group" aria-label="Filter by session" style={{ marginBottom: "10px" }}>
					{sessionChips.map((chip) => (
						<button key={chip.id} type="button" aria-pressed={session === chip.id} onClick={() => setPicked(chip.id)}>
							{chip.label}
						</button>
					))}
				</div>
			)}
			{order === undefined && (
				<div className="av-filters" role="group" aria-label="Filter by type">
					{chips.map((chip) => (
						<button key={chip.id} type="button" aria-pressed={type === chip.id} onClick={() => setType(chip.id)}>
							{chip.label}
						</button>
					))}
				</div>
			)}
			{list.length === 0 && <p className="av-empty">{history.total === 0 ? "No events yet." : "Nothing matches this filter."}</p>}
			<ol className="av-hist">
				{list.map((item) =>
					item.kind === "day" ? (
						<li key={item.key} className="av-hday">
							{head === undefined ? item.text : item.text.replace(/ · (newest|oldest) first$/, "")}
						</li>
					) : (
						<li key={item.row.id}>
							<HistoryRow row={item.row} showSession={showSession} onOpen={() => item.row.item !== null && onOpen(item.row.item)} />
						</li>
					)
				)}
			</ol>
		</aside>
	);
}
