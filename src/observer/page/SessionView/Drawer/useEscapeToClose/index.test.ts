import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useEscapeToClose from "./index.js";

type KeyListener = (event: { key: string }) => void;

/** A `window` fake that records its keydown listeners. */
function stubWindow() {
	const listeners = new Set<KeyListener>();
	vi.stubGlobal("window", {
		addEventListener: (name: string, listener: KeyListener) => {
			if (name === "keydown") listeners.add(listener);
		},
		removeEventListener: (name: string, listener: KeyListener) => {
			if (name === "keydown") listeners.delete(listener);
		},
	});
	return { count: () => listeners.size, press: (key: string) => [...listeners].forEach((listener) => listener({ key })) };
}

function mount(onClose: () => void) {
	function Probe() {
		useEscapeToClose({ onClose });
		return createElement(Text, null, "open");
	}
	return render(createElement(Probe));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useEscapeToClose", () => {
	it("closes on Escape and on no other key", () => {
		const keys = stubWindow();
		const onClose = vi.fn();
		const view = mount(onClose);

		keys.press("Enter");
		keys.press("a");
		expect(onClose).not.toHaveBeenCalled();
		keys.press("Escape");
		expect(onClose).toHaveBeenCalledTimes(1);
		view.unmount();
	});

	it("listens on the window while mounted and stops when it unmounts", () => {
		const keys = stubWindow();
		const view = mount(vi.fn());
		expect(keys.count()).toBe(1);

		view.unmount();
		expect(keys.count()).toBe(0);
	});
});
