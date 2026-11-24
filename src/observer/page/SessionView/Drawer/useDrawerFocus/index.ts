import { useEffect, type RefObject } from "react";

/** True for something that can take focus (an element, or the `document.body` fallback of an unfocused page). */
function canFocus(value: unknown): value is { focus(): void; isConnected: boolean } {
	return typeof value === "object" && value !== null && "focus" in value && typeof value.focus === "function";
}

/**
 * Moves focus to `target` when the drawer mounts and back to what had focus before (the button or
 * row that opened it) when it unmounts, if that is still on the page. The drawer is non-modal, so
 * nothing traps focus; this only carries the keyboard user in and out.
 */
export default function useDrawerFocus({ target }: { target: RefObject<{ focus(): void } | null> }): void {
	useEffect(() => {
		const opener = document.activeElement;
		target.current?.focus();
		return () => {
			if (canFocus(opener) && opener.isConnected) opener.focus();
		};
	}, [target]);
}
