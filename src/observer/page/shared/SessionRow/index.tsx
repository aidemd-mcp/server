import type { SessionRowModel } from "@/observer/page/types/index.js";
import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import describeSessionRow from "./describeSessionRow/index.js";

type ActiveProps = {
	archived?: false;
	/** Archives the session at once; archiving is reversible, so there is nothing to confirm. */
	onArchive(): void;
};

type ArchivedProps = {
	archived: true;
	confirming: boolean;
	/** The message of a failed permanent delete, shown inside the confirmation. */
	error: string | null;
	onRestore(): void;
	onAskDelete(): void;
	onCancel(): void;
	onDelete(): void;
};

/**
 * One session in a sessions list (Home's project rows and the Sessions tab). An ended session
 * offers `Archive`, which acts at once. An archived session (`archived`) offers `Restore` and
 * `Delete permanently`; the latter only opens the inline confirmation, and nothing is removed until
 * `Delete history`. `actionError` is the message of a failed archive or restore, shown under the
 * buttons. `now` decides `Today` / `Yesterday` in the start label.
 */
export default function SessionRow({
	row,
	now,
	actionError = null,
	...mode
}: {
	row: SessionRowModel;
	now: Date;
	actionError?: string | null;
} & (ActiveProps | ArchivedProps)) {
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
				{!mode.archived && (
					<>
						<span className="t3">Task </span>
						<b>{task ?? "No task picked yet"}</b>
					</>
				)}
			</div>
			<div className="s-act">
				<span className={`av-badge ${badge.className}`}>
					<Icon name={badge.icon} />
					{badge.word}
				</span>
				{ended && !mode.archived && (
					<button type="button" className="av-btn" aria-label={`Archive session ${startLabel}`} onClick={mode.onArchive}>
						Archive
					</button>
				)}
				{mode.archived && (
					<>
						<button type="button" className="av-btn" aria-label={`Restore session ${startLabel}`} onClick={mode.onRestore}>
							Restore
						</button>
						<button
							type="button"
							className="av-btn danger"
							aria-label={`Delete history of session ${startLabel} permanently`}
							onClick={mode.onAskDelete}
						>
							<Icon name="trash" />
							Delete permanently
						</button>
					</>
				)}
			</div>
			{actionError !== null && <span className="meta s-err">{actionError}</span>}
			{mode.archived && mode.confirming && (
				<div className="av-confirm" role="alertdialog" aria-label="Confirm delete">
					<Icon name="trash" size="lg" style={{ color: "var(--danger)" }} />
					<p>Delete this session&apos;s history? This can&apos;t be undone.</p>
					<button type="button" className="av-btn" onClick={mode.onCancel}>
						Cancel
					</button>
					<button type="button" className="av-btn danger-solid" onClick={mode.onDelete}>
						Delete history
					</button>
					{mode.error !== null && <span className="meta">{mode.error}</span>}
				</div>
			)}
		</div>
	);
}
