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
	it("draws a Projects button and the project's name, then the pill and the theme switch", () => {
		const html = render(header, "live");
		expect(stripMarkup(html)).toBe("AProjectsaidemd-mcpLive");
		expect(html).toContain('<span class="av-hnav-title">aidemd-mcp</span>');
		expect(html).toContain('class="av-btn av-home-btn"');
		expect(html).toContain('class="av-conn live"');
		expect(html).toContain('aria-label="Switch to light theme"');
	});

	it("has no breadcrumb, session start, project path or kanban tag", () => {
		const html = render(header, "live");
		expect(html).not.toContain("av-crumbs");
		expect(html).not.toContain("aria-current");
		expect(html).not.toContain("av-hdr-meta");
		const text = stripMarkup(html);
		expect(text).not.toContain("All projects");
		expect(text).not.toContain("session 14:02");
		expect(text).not.toContain("/work/aidemd-mcp");
		expect(text).not.toContain("kanban");
	});

	it("shows the switcher only with two sessions to switch between", () => {
		const options = [
			{ id: "a", start: "14:02", now: "Plan · x", pressed: true },
			{ id: "b", start: "15:30", now: "Research · y", pressed: false },
		];
		expect(render({ ...header, switcher: options }, "live")).toContain("av-switch");
		expect(render({ ...header, switcher: options.slice(0, 1) }, "live")).not.toContain("av-switch");
		expect(render(header, "live")).not.toContain("av-switch");
	});

	it("has no pill for a session with nothing live", () => {
		expect(render(header, null)).not.toContain("av-conn");
	});
});
