import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";
import type { ConnState, SessionHeaderModel } from "@/observer/page/types/index.js";
import SessionHeader from "./index.js";

const header: SessionHeaderModel = {
	homeHref: "/?token=tok",
	project: "aidemd-mcp",
	sessionStart: "14:02",
	rootPath: "/work/aidemd-mcp",
	kanbanTag: "aidemd",
	switcher: [],
};

function render(model: SessionHeaderModel, conn: ConnState | null): string {
	return renderToStaticMarkup(
		<ThemeContext.Provider value={{ theme: "dark", toggle: () => undefined }}>
			<SessionHeader header={model} conn={conn} onPickSession={() => undefined} />
		</ThemeContext.Provider>,
	);
}

describe("SessionHeader", () => {
	it("draws the breadcrumb with the current session as the page, the root, the tag, the pill and the theme switch", () => {
		const html = render(header, "live");
		expect(stripMarkup(html)).toBe("All projects/aidemd-mcp/session 14:02/work/aidemd-mcpkanban aidemdLive");
		expect(html).toContain('<span class="here" aria-current="page">session 14:02</span>');
		expect(html).toContain('<button type="button" class="av-linkbtn">All projects</button>');
		expect(html).toContain('class="av-conn live"');
		expect(html).toContain('aria-label="Switch to light theme"');
	});

	it("leaves out the root and tag the stream never reported, and the separator between them", () => {
		const html = render({ ...header, rootPath: null, kanbanTag: null }, "idle");
		expect(html).not.toContain("av-hdr-meta");
		expect(html).not.toContain("dot-sep");
		const onlyTag = render({ ...header, rootPath: null }, "idle");
		expect(onlyTag).toContain("kanban");
		expect(onlyTag).not.toContain("dot-sep");
	});

	it("shows the switcher only with two sessions to switch between", () => {
		const options = [
			{ id: "a", start: "14:02", now: "Plan · x", pressed: true },
			{ id: "b", start: "15:30", now: "Research · y", pressed: false },
		];
		expect(render({ ...header, switcher: options }, "live")).toContain("av-switch");
		expect(render(header, "live")).not.toContain("av-switch");
	});

	it("has no pill for a session with nothing live, and no session part before one is known", () => {
		const html = render({ ...header, sessionStart: null }, null);
		expect(html).not.toContain("av-conn");
		expect(html).not.toContain("aria-current");
	});
});
