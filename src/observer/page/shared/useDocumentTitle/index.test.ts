import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useDocumentTitle from "./index.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useDocumentTitle", () => {
	it("sets document.title and updates it when the title changes", async () => {
		const doc = { title: "" };
		vi.stubGlobal("document", doc);
		function Probe({ title }: { title: string }) {
			useDocumentTitle({ title });
			return createElement(Text, null, title);
		}
		const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

		const view = render(createElement(Probe, { title: "AIDE Pipeline Viewer" }));
		await settle();
		expect(doc.title).toBe("AIDE Pipeline Viewer");

		view.rerender(createElement(Probe, { title: "Waiting on you — AIDE Pipeline Viewer" }));
		await settle();
		expect(doc.title).toBe("Waiting on you — AIDE Pipeline Viewer");
		view.unmount();
	});
});
