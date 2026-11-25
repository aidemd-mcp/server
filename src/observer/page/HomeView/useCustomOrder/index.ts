import { useState } from "react";
import type { ProjectOrder } from "../sortProjects/index.js";

/** Where the viewer's order mode and saved project order are kept in this browser. */
const MODE_KEY = "aide-viewer:project-order-mode";
const LIST_KEY = "aide-viewer:project-order";

/** Reads a stored value; null when storage is unavailable or empty. */
function read(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Stores a value; silently skipped when storage is unavailable. */
function write(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// storage blocked: the choice lasts for this page only
	}
}

/**
 * Home's order mode (`activity` by default) and the viewer's saved custom order of project keys, both
 * remembered in this browser. `move` puts one project at another's place, starting the custom order
 * from the order on screen when there is none yet.
 */
export default function useCustomOrder(): {
	order: ProjectOrder;
	setOrder(order: ProjectOrder): void;
	custom: string[];
	move(args: { from: string; to: string; current: string[] }): void;
} {
	const [order, setOrderState] = useState<ProjectOrder>(() => (read(MODE_KEY) === "custom" ? "custom" : "activity"));
	const [custom, setCustom] = useState<string[]>(() => {
		try {
			const parsed: unknown = JSON.parse(read(LIST_KEY) ?? "[]");
			return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
		} catch {
			return [];
		}
	});
	const setOrder = (next: ProjectOrder): void => {
		setOrderState(next);
		write(MODE_KEY, next);
	};
	const move = ({ from, to, current }: { from: string; to: string; current: string[] }): void => {
		if (from === to) return;
		const list = current.filter((key) => key !== from);
		const at = list.indexOf(to);
		list.splice(at < 0 ? list.length : at + (current.indexOf(from) < current.indexOf(to) ? 1 : 0), 0, from);
		setCustom(list);
		write(LIST_KEY, JSON.stringify(list));
	};
	return { order, setOrder, custom, move };
}
