import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import WaitBanner from "./index.js";

const props = { file: "plan.aide", module: "src/tools/score", since: "2m", path: "src/tools/score/plan.aide", top: 72 };

describe("WaitBanner", () => {
	const html = renderToStaticMarkup(<WaitBanner {...props} onOpen={() => {}} />);

	it("is one status row sticking under the header at its measured top", () => {
		expect(html).toContain('<div class="av-wait-banner" role="status" style="top:72px">');
	});

	it("says what waits, for which module, and since when, hiding the ticking time from assistive technology", () => {
		const text = stripMarkup(html);
		expect(text).toContain("Waiting on you");
		expect(text).toContain("approve plan.aide for src/tools/score");
		expect(html).toContain('<span class="w-since" aria-hidden="true">since 2m</span>');
	});

	it("draws a phone-only strip below the row with what waits and since when", () => {
		const strip = html.slice(html.indexOf('<div class="av-wait-hint">'));
		expect(strip).toContain('<span class="h-what">');
		expect(stripMarkup(strip)).toContain("approve plan.aide for src/tools/score · since 2m");
	});

	it("has one button, labelled Open <file>, that opens the waiting file in the drawer", () => {
		expect(html).toContain('<button type="button" class="w-open">');
		expect(stripMarkup(html)).toContain("Open plan.aide");
		const onOpen = vi.fn();
		const [button] = findElements({ node: WaitBanner({ ...props, onOpen }), match: (element) => element.props.className === "w-open" });
		(button!.props.onClick as () => void)();
		expect(onOpen).toHaveBeenCalledWith({ kind: "file", path: "src/tools/score/plan.aide" });
	});

	it("offers no approval, only the file to open", () => {
		expect(html.match(/<button/g)).toHaveLength(1);
		expect(stripMarkup(html)).not.toMatch(/Approve\b/);
	});
});
