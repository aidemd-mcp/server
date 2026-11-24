import { useEffect } from "react";

/**
 * Calls `onClose` when Escape is pressed anywhere in the window, for as long as the caller is
 * mounted (the drawer is mounted only while open). The listener sits on the window, not the drawer,
 * so Escape works wherever the focus is, and it is removed when the drawer closes.
 */
export default function useEscapeToClose({ onClose }: { onClose(): void }): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);
}
