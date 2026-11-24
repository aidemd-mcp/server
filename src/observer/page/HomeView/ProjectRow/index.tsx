import Icon from "@/observer/page/shared/Icon/index.js";
import joinClasses from "@/observer/page/shared/joinClasses/index.js";
import SessionRow from "@/observer/page/shared/SessionRow/index.js";
import type { ProjectRowModel } from "@/observer/page/types/index.js";

/**
 * One project on Home: a header button (a real `<button>` with `aria-expanded`) that opens its
 * sessions and an `Open <name> →` link to the newest one. Delete lives on each ended session row
 * and asks first; `confirmingId` is the one session whose confirmation is open, `error` the message
 * of its failed delete. The row turns amber while a gate is open in the project.
 */
export default function ProjectRow({
	project,
	open,
	now,
	confirmingId,
	error,
	onToggle,
	onOpen,
	onAskDelete,
	onCancel,
	onDelete,
}: {
	project: ProjectRowModel;
	open: boolean;
	now: Date;
	confirmingId: string | null;
	error: string | null;
	onToggle(): void;
	onOpen(): void;
	onAskDelete(sessionId: string): void;
	onCancel(): void;
	onDelete(sessionId: string): void;
}) {
	return (
		<div className={joinClasses("av-proj", project.waiting && "waiting")}>
			<button type="button" className="av-proj-h" aria-expanded={open} onClick={onToggle}>
				<Icon name={open ? "chev-d" : "chev-r"} size="lg" />
				<span className="p-name">
					{project.name}
					{project.liveCount > 0 && (
						<span className="av-badge run">
							<Icon name="run" />
							{project.liveCount} live
						</span>
					)}
					{project.waiting && (
						<span className="av-badge wait">
							<Icon name="wait" />
							Waiting on you
						</span>
					)}
				</span>
				<span className="p-root">
					{project.root ?? (
						<span className="t3" style={{ fontFamily: "var(--font)" }}>
							No folder reported
						</span>
					)}
				</span>
				{project.kanbanTag === null ? (
					<span className="p-tag" />
				) : (
					<span className="p-tag av-chip">
						<Icon name="board" />
						{project.kanbanTag}
					</span>
				)}
				<span className="p-last">{project.lastActivity}</span>
			</button>
			{open && (
				<div className="av-proj-body">
					{project.rows.length > 0 && (
						<div className="av-list">
							{project.rows.map((row) => (
								<SessionRow
									key={row.sessionId}
									row={row}
									now={now}
									confirming={confirmingId === row.sessionId}
									error={confirmingId === row.sessionId ? error : null}
									onAskDelete={() => onAskDelete(row.sessionId)}
									onCancel={onCancel}
									onDelete={() => onDelete(row.sessionId)}
								/>
							))}
						</div>
					)}
					{project.openHref !== null && (
						<div style={{ marginTop: 10 }}>
							<button type="button" className="av-linkbtn" onClick={onOpen}>
								Open {project.name} →
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
