import { useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";

/** The word a picker line shows for a session's liveness. */
const WORD = { live: "Live", idle: "Idle", ended: "Ended" } as const;

/**
 * The History bar's session picker: a chip naming the session whose events History and the phase
 * rail show (`Session 15:45 · Live ▾`) that opens a list of the project's sessions, newest first.
 * Picking one only changes that; it never reloads or navigates, since the rest of the page is the
 * project's current files.
 */
export default function SessionPicker({
	sessions,
	current,
	now,
	onPick,
}: {
	sessions: SessionRowModel[];
	current: string;
	now: Date;
	onPick(sessionId: string): void;
}) {
	const [open, setOpen] = useState(false);
	const here = sessions.find((row) => row.sessionId === current) ?? null;
	const label = (row: SessionRowModel): string => formatClock({ iso: row.startedAt, now }).start;
	return (
		<div className="av-picker">
			<button type="button" className="av-picker-btn" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(!open)}>
				<span>Session {here === null ? "" : formatClock({ iso: here.startedAt, now }).clock}</span>
				{here !== null && <span className={`p-live ${here.liveness}`}>{WORD[here.liveness]}</span>}
				<Icon name="chev-d" />
			</button>
			{open && (
				<ul className="av-picker-list" role="listbox" aria-label="Sessions in this project">
					{sessions.map((row) => (
						<li key={row.sessionId} role="option" aria-selected={row.sessionId === current}>
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									onPick(row.sessionId);
								}}
							>
								<span>{label(row)}</span>
								<span className={`p-live ${row.liveness}`}>{WORD[row.liveness]}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
