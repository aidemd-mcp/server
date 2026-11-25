import { useEffect, useState } from "react";
import clampSize from "@/observer/page/shared/clampSize/index.js";

/** Where the chosen Details width is remembered for this viewer. */
const STORAGE_KEY = "aide-viewer:details-width";

/** The narrowest Details column, and the room always left for the tree beside it. */
const MIN = 360;
const TREE_ROOM = 320;

/** The remembered width, or null for the default; null when storage is unavailable or holds no number. */
function readWidth(): number | null {
	try {
		const stored = Number(window.localStorage.getItem(STORAGE_KEY));
		return Number.isFinite(stored) && stored > 0 ? stored : null;
	} catch {
		return null;
	}
}

/** Remembers the width, or forgets it for null; silently skipped when storage is unavailable. */
function writeWidth(width: number | null): void {
	try {
		if (width === null) window.localStorage.removeItem(STORAGE_KEY);
		else window.localStorage.setItem(STORAGE_KEY, String(width));
	} catch {
		// storage blocked: the width lasts for this page only
	}
}

/**
 * The Details column's chosen width in px, or null while it keeps the page's default, with its
 * bounds: at least 360px, at most the window minus 320px kept for the tree. Setting a width clamps it
 * and remembers it; resetting forgets it. The bounds follow the window as it resizes, so a remembered
 * width never squeezes the tree out.
 */
export default function useDetailWidth(): {
	width: number | null;
	min: number;
	max: number;
	setWidth: (width: number) => void;
	reset: () => void;
} {
	const [width, setStored] = useState(readWidth);
	const [windowWidth, setWindowWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
	useEffect(() => {
		const update = (): void => setWindowWidth(window.innerWidth);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	const max = Math.max(MIN, windowWidth - TREE_ROOM);
	return {
		width: width === null ? null : clampSize({ value: width, min: MIN, max }),
		min: MIN,
		max,
		setWidth: (next) => {
			const clamped = clampSize({ value: next, min: MIN, max });
			setStored(clamped);
			writeWidth(clamped);
		},
		reset: () => {
			setStored(null);
			writeWidth(null);
		},
	};
}
