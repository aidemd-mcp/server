import { useEffect, useRef, useState } from "react";

/** Where the last shown activity order is kept in this browser. */
const STORAGE_KEY = "aide-viewer:project-activity-order";
/** The shortest gap between two re-orders, so a burst of events moves rows once, not repeatedly. */
const SETTLE_MS = 2000;

/** The stored order; empty when storage is unavailable or holds nothing valid. */
function readStored(): string[] {
	try {
		const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
	} catch {
		return [];
	}
}

/** Keeps `order` for the next visit; silently skipped when storage is unavailable. */
function store(order: string[]): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
	} catch {
		// storage blocked: the order lasts for this page only
	}
}

/** `previous` (kept whole, so a remembered order survives until the project list arrives) with keys it lacks appended in `wanted`'s order. */
function reconcile(previous: string[], wanted: string[]): string[] {
	const seen = new Set(previous);
	return [...previous, ...wanted.filter((key) => !seen.has(key))];
}

/**
 * The project order Home shows in activity mode, made calm: it starts from the order remembered in
 * this browser (so a reload shows the same list at once), adopts the live activity order (`wanted`)
 * only once every project's status has arrived (`ready`), at most once every two seconds, and
 * remembers each order it shows. `settled` turns true only after a second adoption, so the caller
 * skips animating the first, data-driven move and slides only later live changes.
 */
export default function useStableOrder({ wanted, ready }: { wanted: string[]; ready: boolean }): { order: string[]; settled: boolean } {
	const [order, setOrder] = useState<string[]>(() => reconcile(readStored(), wanted));
	const [adoptions, setAdoptions] = useState(0);
	const settled = adoptions > 0;
	const lastMove = useRef(0);
	const wantedKey = wanted.join("|");

	useEffect(() => {
		if (!ready) {
			setOrder((current) => reconcile(current, wanted));
			return;
		}
		const apply = (): void => {
			lastMove.current = Date.now();
			setOrder(wanted);
			store(wanted);
			setAdoptions((count) => count + 1);
		};
		const wait = settled ? Math.max(0, SETTLE_MS - (Date.now() - lastMove.current)) : 0;
		if (wait === 0) {
			apply();
			return;
		}
		const timer = setTimeout(apply, wait);
		return () => clearTimeout(timer);
		// `wanted` is named by `wantedKey`.
	}, [wantedKey, ready, settled]);

	// The first adoption is the data arriving, not a live change: report it as not yet settled so it is not animated.
	return { order, settled: adoptions > 1 };
}
