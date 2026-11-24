import Icon from "@/observer/page/shared/Icon/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import type { DrawerItem, PlanRowModel } from "@/observer/page/types/index.js";

/** The handoff's four column widths, set on every row so the header lines up with the cells. */
const ROW_STYLE = { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.4fr)" };

/** The handoff's bar colour: the progress bar fills with the running colour. */
const BAR_STYLE = { color: "var(--run)" };

/**
 * The plans and todos table: a div grid (module as a button that opens the file, kind chip, status
 * badge, progress bar with its words), the current module's rows highlighted. `rows` is null for a
 * project that never reported its folder, which gets the calm unavailable notice; an empty list
 * says no module holds a plan or todo.
 */
export default function PlansTable({ rows, onOpen }: { rows: PlanRowModel[] | null; onOpen(item: DrawerItem): void }) {
	if (rows === null) {
		return (
			<Notice tone="calm" icon="folder-off" iconSize="lg" heading="Plans and todos unavailable">
				<p>They&apos;re read from the project folder, which this project hasn&apos;t reported yet.</p>
			</Notice>
		);
	}
	if (rows.length === 0) {
		return (
			<Notice tone="calm" icon="doc" iconSize="lg" heading="No plans or todos">
				<p>No module has a plan.aide or todo.aide right now.</p>
			</Notice>
		);
	}

	return (
		<div className="av-gt" role="table" aria-label="Plans and todos">
			<div className="tr th" role="row" style={ROW_STYLE}>
				<span role="columnheader">Module</span>
				<span role="columnheader">Kind</span>
				<span role="columnheader">Status</span>
				<span role="columnheader">Progress</span>
			</div>
			{rows.map((row) => (
				<div key={`${row.module}:${row.kind}`} className={row.highlighted ? "tr hl" : "tr"} role="row" style={ROW_STYLE}>
					<span role="cell">
						<button type="button" className="av-linkbtn mono" onClick={() => onOpen(row.item)}>
							{row.module}
						</button>
					</span>
					<span role="cell">
						<span className="av-chip">
							<Icon name={row.kind === "plan" ? "step" : "issues"} />
							{row.kind}
						</span>
					</span>
					<span role="cell">
						<span className={`av-badge ${row.tone}`}>
							<Icon name={row.icon} />
							{row.status}
						</span>
					</span>
					<span role="cell" className="prog">
						<span className="av-prog" style={BAR_STYLE}>
							<i style={{ width: `${row.percent}%` }} />
						</span>
						{row.progress}
					</span>
				</div>
			))}
		</div>
	);
}
