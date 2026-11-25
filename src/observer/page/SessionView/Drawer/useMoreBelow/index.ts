import { useEffect, useState } from "react";

/** How close to the end (px) counts as the end. */
const SLACK = 8;

/**
 * Whether a scrolling element has more content below what is on screen, re-checked on scroll,
 * resize and any change to its content, so a "More below" cue can show until the end is reached.
 */
export default function useMoreBelow(element: HTMLElement | null): boolean {
	const [more, setMore] = useState(false);
	useEffect(() => {
		if (element === null) return;
		const check = (): void => setMore(element.scrollTop + element.clientHeight < element.scrollHeight - SLACK);
		check();
		element.addEventListener("scroll", check, { passive: true });
		const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
		resize?.observe(element);
		const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(check);
		mutation?.observe(element, { childList: true, subtree: true });
		return () => {
			element.removeEventListener("scroll", check);
			resize?.disconnect();
			mutation?.disconnect();
		};
	}, [element]);
	return more;
}
