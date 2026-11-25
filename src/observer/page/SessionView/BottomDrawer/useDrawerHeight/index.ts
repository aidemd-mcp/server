import { useState } from "react";
import clampSize from "@/observer/page/shared/clampSize/index.js";

/** Where the chosen bottom-drawer height is remembered for this viewer. */
const STORAGE_KEY = "aide-viewer:bottom-drawer-height";

/** The remembered height, or null for the default; null when storage is unavailable or holds no number. */
function readHeight(): number | null {
	try {
		const stored = Number(window.localStorage.getItem(STORAGE_KEY));
		return Number.isFinite(stored) && stored > 0 ? stored : null;
	} catch {
		return null;
	}
}

/** Remembers the height, or forgets it for null; silently skipped when storage is unavailable. */
function writeHeight(height: number | null): void {
	try {
		if (height === null) window.localStorage.removeItem(STORAGE_KEY);
		else window.localStorage.setItem(STORAGE_KEY, String(height));
	} catch {
		// storage blocked: the height lasts for this page only
	}
}

/**
 * The open bottom drawer's chosen height in px, or null while it keeps the page's default. The caller
 * gives the bounds as currently measured; until they are known (a max of 0 or less) the remembered
 * height is passed through unclamped. Setting a height clamps it and remembers it; resetting forgets it.
 */
export default function useDrawerHeight({ min, max }: { min: number; max: number }): {
	height: number | null;
	setHeight: (height: number) => void;
	reset: () => void;
} {
	const [height, setStored] = useState(readHeight);
	const clamp = (value: number): number => (max > 0 ? clampSize({ value, min, max }) : value);
	return {
		height: height === null ? null : clamp(height),
		setHeight: (next) => {
			const clamped = clamp(next);
			setStored(clamped);
			writeHeight(clamped);
		},
		reset: () => {
			setStored(null);
			writeHeight(null);
		},
	};
}
