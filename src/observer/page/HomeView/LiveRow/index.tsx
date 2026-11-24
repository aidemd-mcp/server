import Icon from "@/observer/page/shared/Icon/index.js";
import type { LiveRowModel } from "@/observer/page/types/index.js";

/**
 * One live or idle session on Home: project and start, the badge for what it is doing (waiting on
 * you, a running phase, or no phase running), its module and agent when reported, and the time on
 * the right. A real button that opens the session.
 */
export default function LiveRow({ row, onOpen }: { row: LiveRowModel; onOpen(): void }) {
	return (
		<button type="button" className="av-live-row" onClick={onOpen}>
			<span className="stack" style={{ gap: 0 }}>
				<span className="lr-p">{row.project}</span>
				<span className="meta">session {row.start}</span>
			</span>
			<span className="lr-now">
				<span className={`av-badge ${row.badge.className}`}>
					<Icon name={row.badge.icon} />
					{row.badge.word}
				</span>
				{row.module !== null && <span className="mono">{row.module}</span>}
				{row.agent !== null && (
					<>
						<span className="t3">by</span>
						<span className="mono">{row.agent}</span>
					</>
				)}
			</span>
			<span className="lr-t">{row.elapsed}</span>
		</button>
	);
}
