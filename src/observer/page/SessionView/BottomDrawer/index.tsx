import { type ReactNode, useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import type { DrawerItem, HistoryModel, IconName, SessionRowModel } from "@/observer/page/types/index.js";
import HistoryPanel from "../HistoryPanel/index.js";
import SessionPicker from "../SessionPicker/index.js";

/** The drawer's panels, in bar order. */
type PanelId = "history" | "sessions" | "board";

/** One launcher in the bar: its id, label, icon and count. */
type Launcher = { id: PanelId; label: string; icon: IconName; count: string | null };

/**
 * The desktop session page's bottom drawer, above the phase rail (like a console's bottom panel).
 * Closed, it is one bar of launchers (History, Sessions, Board, each with its count) and the newest
 * event. Clicking a launcher slides the drawer up showing that panel, and the launchers become its
 * tabs; Hide folds it back. The History list's pinned heading holds its session picker (which
 * session's events it shows) and order switch, as small text links.
 * Rows in History, Sessions and Board still open their detail in the right-hand Details column.
 */
export default function BottomDrawer({
	history,
	sessions,
	board,
	counts,
	onOpen,
	picker,
}: {
	history: HistoryModel;
	/** The Sessions panel's content (project info and the sessions list). */
	sessions: ReactNode;
	/** The Board panel's content. */
	board: ReactNode;
	counts: { sessions: string; board: string | null };
	onOpen(item: DrawerItem): void;
	/** The project's sessions, the one History follows and how to pick another, for the session picker in the bar. */
	picker: { sessions: SessionRowModel[]; current: string; now: Date; onPick(sessionId: string): void };
}) {
	const [open, setOpen] = useState<PanelId | null>(null);
	const [newest, setNewest] = useState(true);
	const latest = [...history.rows].reverse().find((row) => row.kind !== "sub") ?? null;
	const launchers: Launcher[] = [
		{ id: "history", label: "History", icon: "history", count: String(history.total) },
		{ id: "sessions", label: "Sessions", icon: "sessions", count: counts.sessions },
		{ id: "board", label: "Board", icon: "board", count: counts.board },
	];

	return (
		<div className={open !== null ? "av-histdrawer open" : "av-histdrawer"}>
			<div className="av-histbar-row" role="tablist" aria-label="Bottom drawer">
				{launchers.map((launcher) => (
					<button
						key={launcher.id}
						type="button"
						role="tab"
						className="av-launch"
						aria-selected={open === launcher.id}
						onClick={() => setOpen(open === launcher.id ? null : launcher.id)}
					>
						<Icon name={launcher.icon} />
						{launcher.label}
						{launcher.count !== null && <span className="n">{launcher.count}</span>}
					</button>
				))}
				<span className="hb-latest">
					{latest !== null && (
						<>
							<span className="mono">{latest.time}</span> {latest.label}
							{latest.mono !== null && <span className="mono"> {latest.mono}</span>}
						</>
					)}
				</span>
				{open !== null && (
					<button type="button" className="av-btn ghost hb-hide" onClick={() => setOpen(null)}>
						<Icon name="chev-d" />
						Hide
					</button>
				)}
			</div>
			{open !== null && (
				<div className="av-histdrawer-b" role="tabpanel">
					{open === "history" && (
						<HistoryPanel
							history={history}
							onOpen={onOpen}
							order={{ newest }}
							head={
								<>
									{picker.sessions.length > 0 && <SessionPicker {...picker} />}
									<button
										type="button"
										className="hh-order"
										aria-label={newest ? "Newest first; switch to oldest first" : "Oldest first; switch to newest first"}
										onClick={() => setNewest(!newest)}
									>
										{newest ? "Newest first" : "Oldest first"}
										<span aria-hidden="true">{newest ? "↓" : "↑"}</span>
									</button>
								</>
							}
						/>
					)}
					{open === "sessions" && <div className="av-drawer-pad">{sessions}</div>}
					{open === "board" && <div className="av-drawer-pad">{board}</div>}
				</div>
			)}
		</div>
	);
}
