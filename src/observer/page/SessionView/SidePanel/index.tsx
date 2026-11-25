import { useEffect, useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import type { DrawerContext, DrawerItem } from "@/observer/page/types/index.js";
import Drawer from "../Drawer/index.js";

/** Docked details have no close: the column always stays. */
const KEEP_OPEN = (): void => {};

/** Where the collapsed choice is remembered for this viewer. */
const STORAGE_KEY = "aide-viewer:details-collapsed";

/** The remembered collapsed choice; false when storage is unavailable. */
function readCollapsed(): boolean {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

/** Remembers the collapsed choice; silently skipped when storage is unavailable. */
function writeCollapsed(value: boolean): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
	} catch {
		// storage blocked: the choice lasts for this page only
	}
}

/**
 * The desktop Details column: beside the main area, filling the page's middle row and scrolling
 * inside itself. It shows the selected item's detail, or a calm prompt to pick one. A button in its
 * corner collapses it to a slim vertical `Details` tab on the page's edge, which gives the main area
 * the room on a small screen; clicking the tab, or opening any item, brings it back. The choice is
 * remembered for this viewer.
 */
export default function SidePanel({ item, context }: { item: DrawerItem | null; context: DrawerContext }) {
	const [collapsed, setCollapsed] = useState(readCollapsed);
	const itemKey = item === null ? null : JSON.stringify(item);
	const change = (value: boolean): void => {
		setCollapsed(value);
		writeCollapsed(value);
	};
	useEffect(() => {
		if (itemKey !== null) change(false);
	}, [itemKey]);

	if (collapsed) {
		return (
			<button type="button" className="av-sidetab" aria-expanded={false} aria-label="Show details" onClick={() => change(false)}>
				<Icon name="chev-r" className="flip" />
				<span className="t">Details</span>
			</button>
		);
	}
	return (
		<div className="av-sidepanel">
			<button type="button" className="av-btn ghost av-side-collapse" aria-expanded={true} aria-label="Hide details" onClick={() => change(true)}>
				Hide
				<Icon name="chev-r" />
			</button>
			{item !== null ? (
				<Drawer item={item} context={context} docked onClose={KEEP_OPEN} />
			) : (
				<div className="av-side-empty">
					<Icon name="doc" size="lg" />
					<p>Click a module, plan, task or history event to read it here.</p>
				</div>
			)}
		</div>
	);
}
