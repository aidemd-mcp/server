import type { SessionRowModel } from "@/observer/page/types/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import describeSessionRow from "./describeSessionRow/index.js";

/**
 * One session in a sessions list (Home's project rows and the Sessions tab). Delete exists only on
 * an ended session and only opens the inline confirmation; nothing is removed until `Delete
 * history`. `error` is the message of a failed delete, shown inside the confirmation. `now` decides
 * `Today` / `Yesterday` in the start label.
 */
export default function SessionRow({
	row,
	now,
	confirming,
	error,
	onAskDelete,
	onCancel,
	onDelete,
}: {
	row: SessionRowModel;
	now: Date;
	confirming: boolean;
	error: string | null;
	onAskDelete(): void;
	onCancel(): void;
	onDelete(): void;
}) {
	const { startLabel, duration, task, ended, live, badge } = describeSessionRow({ row, now });
	return (
		<div className={joinClasses("av-srow", live && "live")}>
			<div className="s-when">
				<b>{startLabel}</b>
				<span className="meta">
					<span className="mono">{duration}</span> · {row.eventCount} {row.eventCount === 1 ? "event" : "events"}
				</span>
			</div>
			<div className="s-task">
				<span className="t3">Task </span>
				<b>{task ?? "No task picked yet"}</b>
			</div>
			<div className="s-act">
				<span className={`av-badge ${badge.className}`}>
					<Icon name={badge.icon} />
					{badge.word}
				</span>
				{ended && (
					<button
						type="button"
						className="av-btn danger"
						aria-label={`Delete history of session ${startLabel}`}
						onClick={onAskDelete}
					>
						<Icon name="trash" />
						Delete
					</button>
				)}
			</div>
			{ended && confirming && (
				<div className="av-confirm" role="alertdialog" aria-label="Confirm delete">
					<Icon name="trash" size="lg" style={{ color: "var(--danger)" }} />
					<p>Delete this session&apos;s history? This can&apos;t be undone.</p>
					<button type="button" className="av-btn" onClick={onCancel}>
						Cancel
					</button>
					<button type="button" className="av-btn danger-solid" onClick={onDelete}>
						Delete history
					</button>
					{error !== null && <span className="meta">{error}</span>}
				</div>
			)}
		</div>
	);
}
