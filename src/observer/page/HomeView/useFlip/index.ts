import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Slides the children of `container` that carry `data-flip` from where they were to where they now
 * are whenever `orderKey` changes (a FLIP animation), so a re-ordered list moves instead of jumping.
 * Only rows that actually moved slide, gently; nothing animates while `enabled` is false (positions are
 * still recorded) or when the viewer asked for reduced motion.
 */
export default function useFlip({ container, orderKey, enabled }: { container: RefObject<HTMLElement | null>; orderKey: string; enabled: boolean }): void {
	const last = useRef(new Map<string, number>());
	useLayoutEffect(() => {
		const root = container.current;
		if (root === null) return;
		const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const next = new Map<string, number>();
		for (const element of root.querySelectorAll<HTMLElement>("[data-flip]")) {
			const key = element.dataset.flip!;
			const top = element.getBoundingClientRect().top;
			next.set(key, top);
			const before = last.current.get(key);
			if (!enabled || reduce || before === undefined || Math.abs(before - top) < 2 || typeof element.animate !== "function") continue;
			element.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], { duration: 380, easing: "cubic-bezier(0.2, 0, 0, 1)" });
		}
		last.current = next;
	}, [container, orderKey, enabled]);
}
