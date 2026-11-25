import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useRef: (initial: unknown) => ({ current: initial }) };
});

import ResizeHandle from "./index.js";
import type { ResizeGrow } from "@/observer/page/types/index.js";

/** A handle element whose parent is drawn at the given size, with pointer capture stubbed. */
function target(size: { width: number; height: number }) {
	return {
		parentElement: { getBoundingClientRect: () => size },
		setPointerCapture: vi.fn(),
		releasePointerCapture: vi.fn(),
		hasPointerCapture: () => true,
	};
}

/** Calls the handle as a function, so its event props can be fired without a DOM. */
function handle({ grow = "left" as ResizeGrow, value = null as number | null, min = 360, max = 900 } = {}) {
	const onResize = vi.fn();
	const onReset = vi.fn();
	const element = ResizeHandle({ label: "Resize details", grow, value, min, max, onResize, onReset });
	return { props: element.props as Record<string, (event: unknown) => void>, onResize, onReset };
}

describe("ResizeHandle", () => {
	it("draws a focusable separator with its label, bounds and value", () => {
		const html = renderToStaticMarkup(<ResizeHandle label="Resize details" grow="left" value={500} min={360} max={900} onResize={() => undefined} onReset={() => undefined} />);
		expect(html).toContain('role="separator"');
		expect(html).toContain('tabindex="0"');
		expect(html).toContain('aria-orientation="vertical"');
		expect(html).toContain('aria-valuenow="500" aria-valuemin="360" aria-valuemax="900"');
		expect(html).toContain('class="av-resize x grow-left"');
	});

	it("is a horizontal separator for an area that grows up or down", () => {
		const html = renderToStaticMarkup(<ResizeHandle label="Resize" grow="up" value={null} min={200} max={600} onResize={() => undefined} onReset={() => undefined} />);
		expect(html).toContain('aria-orientation="horizontal"');
		expect(html).toContain('class="av-resize y grow-up"');
		expect(html).not.toContain("aria-valuenow");
	});

	it("grows the area by the drag distance in its growing direction, from its drawn size, clamped", () => {
		const { props, onResize } = handle({ grow: "left" });
		const currentTarget = target({ width: 500, height: 0 });
		props.onPointerDown!({ button: 0, clientX: 800, clientY: 0, pointerId: 1, currentTarget, preventDefault: vi.fn() });
		props.onPointerMove!({ clientX: 700, clientY: 0, currentTarget });
		expect(onResize).toHaveBeenLastCalledWith(600);
		props.onPointerMove!({ clientX: 1200, clientY: 0, currentTarget });
		expect(onResize).toHaveBeenLastCalledWith(360);
		props.onPointerUp!({ pointerId: 1, currentTarget });
		props.onPointerMove!({ clientX: 0, clientY: 0, currentTarget });
		expect(onResize).toHaveBeenCalledTimes(2);
	});

	it("grows an upward area when dragged up", () => {
		const { props, onResize } = handle({ grow: "up", min: 100, max: 800 });
		const currentTarget = target({ width: 0, height: 300 });
		props.onPointerDown!({ button: 0, clientX: 0, clientY: 500, pointerId: 1, currentTarget, preventDefault: vi.fn() });
		props.onPointerMove!({ clientX: 0, clientY: 450, currentTarget });
		expect(onResize).toHaveBeenLastCalledWith(350);
	});

	it("ignores a drag with any button but the main one", () => {
		const { props, onResize } = handle();
		const currentTarget = target({ width: 500, height: 0 });
		props.onPointerDown!({ button: 2, clientX: 800, clientY: 0, pointerId: 1, currentTarget, preventDefault: vi.fn() });
		props.onPointerMove!({ clientX: 700, clientY: 0, currentTarget });
		expect(onResize).not.toHaveBeenCalled();
	});

	it("resizes by 16px per arrow key, 64px with Shift, and resets on Enter or double-click", () => {
		const { props, onResize, onReset } = handle({ grow: "left" });
		const currentTarget = target({ width: 500, height: 0 });
		const key = (name: string, shiftKey = false) => props.onKeyDown!({ key: name, shiftKey, currentTarget, preventDefault: vi.fn() });
		key("ArrowLeft");
		expect(onResize).toHaveBeenLastCalledWith(516);
		key("ArrowRight", true);
		expect(onResize).toHaveBeenLastCalledWith(436);
		key("Tab");
		expect(onResize).toHaveBeenCalledTimes(2);
		key("Enter");
		props.onDoubleClick!({});
		expect(onReset).toHaveBeenCalledTimes(2);
	});
});
