import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import clampSize from "@/observer/page/shared/clampSize/index.js";
import type { ResizeGrow } from "@/observer/page/types/index.js";

/** Pixels per arrow key press, and with Shift held. */
const STEP = 16;
const BIG_STEP = 64;

/** The arrow key that grows the area for each direction, and the one that shrinks it. */
const KEYS: Record<ResizeGrow, { grow: string; shrink: string }> = {
	left: { grow: "ArrowLeft", shrink: "ArrowRight" },
	right: { grow: "ArrowRight", shrink: "ArrowLeft" },
	up: { grow: "ArrowUp", shrink: "ArrowDown" },
	down: { grow: "ArrowDown", shrink: "ArrowUp" },
};

/**
 * A drag handle on one edge of an area, as a focusable separator placed inside that area. Dragging
 * it, or pressing the arrow keys (Shift for bigger steps), reports the area's new size, clamped to its
 * bounds. Each drag or key press starts from the area's size as drawn, so an area still at its CSS
 * default needs no number. Double-clicking it, or pressing Enter, asks to reset the size. The parent
 * owns the size and where it is kept.
 */
export default function ResizeHandle({
	label,
	grow,
	value,
	min,
	max,
	onResize,
	onReset,
}: {
	label: string;
	grow: ResizeGrow;
	value: number | null;
	min: number;
	max: number;
	onResize: (size: number) => void;
	onReset: () => void;
}) {
	const drag = useRef<{ x: number; y: number; size: number } | null>(null);
	const horizontal = grow === "left" || grow === "right";

	/** The area's size as drawn: the handle's parent, across the resized axis. */
	const drawnSize = (handle: HTMLElement): number => {
		const box = handle.parentElement?.getBoundingClientRect();
		return box === undefined ? (value ?? min) : horizontal ? box.width : box.height;
	};
	const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { x: event.clientX, y: event.clientY, size: drawnSize(event.currentTarget) };
	};
	const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
		const start = drag.current;
		if (start === null) return;
		const moved = { left: start.x - event.clientX, right: event.clientX - start.x, up: start.y - event.clientY, down: event.clientY - start.y }[grow];
		onResize(clampSize({ value: start.size + moved, min, max }));
	};
	const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
		drag.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		const step = event.shiftKey ? BIG_STEP : STEP;
		const keys = KEYS[grow];
		if (event.key === keys.grow) onResize(clampSize({ value: drawnSize(event.currentTarget) + step, min, max }));
		else if (event.key === keys.shrink) onResize(clampSize({ value: drawnSize(event.currentTarget) - step, min, max }));
		else if (event.key === "Enter") onReset();
		else return;
		event.preventDefault();
	};

	return (
		<div
			role="separator"
			tabIndex={0}
			aria-label={label}
			aria-orientation={horizontal ? "vertical" : "horizontal"}
			aria-valuenow={value === null ? undefined : Math.round(value)}
			aria-valuemin={Math.round(min)}
			aria-valuemax={Math.round(max)}
			title={`${label}: drag, or use the arrow keys. Double-click to reset.`}
			className={`av-resize ${horizontal ? "x" : "y"} grow-${grow}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onDoubleClick={onReset}
			onKeyDown={onKeyDown}
		/>
	);
}
