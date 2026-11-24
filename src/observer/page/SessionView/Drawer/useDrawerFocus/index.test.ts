import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useDrawerFocus from "./index.js";

/** An element fake: records focus calls and says whether it is still on the page. */
function makeElement({ connected = true }: { connected?: boolean } = {}) {
	return { focus: vi.fn(), isConnected: connected };
}

function mount(target: { current: { focus(): void } | null }) {
	function Probe() {
		useDrawerFocus({ target });
		return createElement(Text, null, "open");
	}
	return render(createElement(Probe));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useDrawerFocus", () => {
	it("moves focus to the target on open and back to the opener on close", () => {
		const opener = makeElement();
		vi.stubGlobal("document", { activeElement: opener });
		const target = { current: makeElement() };

		const view = mount(target);
		expect(target.current.focus).toHaveBeenCalledTimes(1);
		expect(opener.focus).not.toHaveBeenCalled();

		view.unmount();
		expect(opener.focus).toHaveBeenCalledTimes(1);
	});

	it("leaves focus alone when the opener is gone from the page by close", () => {
		const opener = makeElement({ connected: false });
		vi.stubGlobal("document", { activeElement: opener });

		const view = mount({ current: makeElement() });
		view.unmount();
		expect(opener.focus).not.toHaveBeenCalled();
	});

	it("copes with no opener and with a target that is not there yet", () => {
		vi.stubGlobal("document", { activeElement: null });

		const view = mount({ current: null });
		expect(() => view.unmount()).not.toThrow();
	});
});
