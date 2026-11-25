import { useEffect, useState } from "react";

/**
 * The element's rendered height in px, re-measured whenever it resizes. It exists because the
 * session view's sticky header is what the now card must clear before it counts as visible, and
 * that header wraps to different heights by width and content, so the height cannot be hard-coded.
 * Returns 0 until an element arrives; where `ResizeObserver` is missing it measures once and does
 * not follow.
 */
export default function useElementHeight(element: HTMLElement | null): number {
	const [height, setHeight] = useState<number>(0);

	useEffect(() => {
		if (element === null) {
			setHeight(0);
			return;
		}
		const measure = () => setHeight(Math.round(element.getBoundingClientRect().height));
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [element]);

	return height;
}
