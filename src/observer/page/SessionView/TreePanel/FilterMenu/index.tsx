import { useEffect, useRef, useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import type { TreeView } from "@/observer/page/types/index.js";

/** The tree's toggles as the menu lists them. */
const FILTERS: { key: "onlyOpen" | "onlyMisaligned" | "onlyPlans" | "onlyTodos"; label: string }[] = [
	{ key: "onlyOpen", label: "Only open work" },
	{ key: "onlyMisaligned", label: "Only misaligned" },
	{ key: "onlyPlans", label: "Has plan" },
	{ key: "onlyTodos", label: "Has todo" },
];

/**
 * The intent tree's filters in one dropdown beside the path search: a `Filters` button that says how
 * many are on and opens a menu of checkboxes (only open work, only misaligned, has plan, has todo),
 * plus `Clear` when any is on. Clicking outside or pressing Escape closes it.
 */
export default function FilterMenu({ view, onChange }: { view: TreeView; onChange(view: TreeView): void }) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const active = FILTERS.filter((filter) => view[filter.key]).length;

	useEffect(() => {
		if (!open) return;
		const away = (event: MouseEvent): void => {
			if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
		};
		const escape = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", away);
		document.addEventListener("keydown", escape);
		return () => {
			document.removeEventListener("mousedown", away);
			document.removeEventListener("keydown", escape);
		};
	}, [open]);

	return (
		<div className="av-filtermenu" ref={root}>
			<button type="button" className="av-btn" aria-expanded={open} aria-haspopup="true" aria-pressed={active > 0} onClick={() => setOpen(!open)}>
				Filters
				{active > 0 && <span className="fm-n">{active}</span>}
				<Icon name="chev-d" />
			</button>
			{open && (
				<div className="av-filtermenu-list" role="group" aria-label="Tree filters">
					{FILTERS.map((filter) => (
						<label key={filter.key}>
							<input type="checkbox" checked={view[filter.key]} onChange={() => onChange({ ...view, [filter.key]: !view[filter.key] })} />
							{filter.label}
						</label>
					))}
					{active > 0 && (
						<button
							type="button"
							className="av-btn ghost fm-clear"
							onClick={() => onChange({ ...view, onlyOpen: false, onlyMisaligned: false, onlyPlans: false, onlyTodos: false })}
						>
							Clear filters
						</button>
					)}
				</div>
			)}
		</div>
	);
}
