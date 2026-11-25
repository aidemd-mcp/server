import { useEffect, useState } from "react";

/**
 * Whether any part of `element` lies inside the viewport below a top band of `topInset` px (the
 * sticky header). The slim waiting bar shows only while the now card is out of view, so this
 * defaults to "in view" for a null element, before the first observation, and wherever
 * `IntersectionObserver` is undefined: no environment without an observer, and no first paint,
 * ever shows two waiting blocks at once.
 */
export default function useInView({ element, topInset }: { element: Element | null; topInset: number }): boolean {
	const [inView, setInView] = useState(true);

	useEffect(() => {
		if (element === null || typeof IntersectionObserver === "undefined") {
			setInView(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				const latest = entries[entries.length - 1];
				if (latest !== undefined) setInView(latest.isIntersecting);
			},
			{ rootMargin: `-${topInset}px 0px 0px 0px`, threshold: 0 },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [element, topInset]);

	return inView;
}
