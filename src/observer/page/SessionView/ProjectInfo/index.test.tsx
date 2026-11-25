import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import ProjectInfo from "./index.js";

describe("ProjectInfo", () => {
	it("draws the project folder and the kanban tag, each with a Copy button", () => {
		const html = renderToStaticMarkup(<ProjectInfo rootPath="/work/app" kanbanTag="app" />);
		expect(html).toContain('<div class="av-projinfo">');
		expect(stripMarkup(html)).toBe("Project folder/work/appCopyKanban tagappCopy");
		expect(html).toContain('aria-label="Copy project folder"');
		expect(html).toContain('aria-label="Copy kanban tag"');
		expect(html.match(/>Copy</g)).toHaveLength(2);
	});

	it("draws only the folder when no kanban tag was reported", () => {
		const html = renderToStaticMarkup(<ProjectInfo rootPath="/work/app" kanbanTag={null} />);
		expect(html).toContain("Project folder");
		expect(html).not.toContain("Kanban tag");
	});

	it("draws only the tag when no folder was reported", () => {
		const html = renderToStaticMarkup(<ProjectInfo rootPath={null} kanbanTag="app" />);
		expect(html).toContain("Kanban tag");
		expect(html).not.toContain("Project folder");
	});

	it("draws nothing when neither is known", () => {
		expect(renderToStaticMarkup(<ProjectInfo rootPath={null} kanbanTag={null} />)).toBe("");
	});
});
