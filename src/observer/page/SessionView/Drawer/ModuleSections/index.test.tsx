import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrawerSection } from "@/observer/page/types/index.js";
import ModuleSections from "./index.js";

const LIST: DrawerSection[] = [
	{ kind: "spec", label: ".aide", path: "src/a/.aide", status: "aligned", blocks: [{ heading: "Frontmatter", icon: "doc", badge: null, type: "pre", text: "SPEC-BODY" }] },
	{ kind: "plan", label: "plan.aide", path: "src/a/plan.aide", status: "approved · 1/2", blocks: [{ heading: "Body", icon: "list", badge: null, type: "pre", text: "PLAN-BODY" }] },
	{ kind: "brief", label: "brief", path: "", status: null, blocks: [{ heading: "Body", icon: "list", badge: null, type: "pre", text: "BRIEF-BODY" }] },
];

const html = (open: DrawerSection["kind"]) => renderToStaticMarkup(<ModuleSections list={LIST} open={open} />);

describe("ModuleSections", () => {
	it("draws one accordion row per file, labelled by file name and titled by its path", () => {
		const markup = html("spec");
		expect(markup.match(/<section /g)).toHaveLength(3);
		expect(markup).toContain('title="src/a/.aide"');
		expect(markup).toContain('<span class="mono f-name">plan.aide</span>');
		expect(markup).toContain('<span class="mono f-name">brief</span>');
	});

	it("shows a file's status beside its name, and none for a file without one", () => {
		const markup = html("spec");
		expect(markup).toContain('<span class="f-status">aligned</span>');
		expect(markup).toContain('<span class="f-status">approved · 1/2</span>');
		expect(markup.match(/class="f-status"/g)).toHaveLength(2);
	});

	it("expands only the row named open, with its blocks, and folds the others", () => {
		const markup = html("plan");
		expect(markup).toContain("PLAN-BODY");
		expect(markup).not.toContain("SPEC-BODY");
		expect(markup).not.toContain("BRIEF-BODY");
		expect(markup.match(/aria-expanded="true"/g)).toHaveLength(1);
		expect(markup.match(/aria-expanded="false"/g)).toHaveLength(2);
		expect(markup).toContain('<section class="av-file open">');
	});

	it("marks the open row's chevron down and the folded rows' right", () => {
		const markup = html("spec");
		expect(markup.match(/i-chev-d/g)).toHaveLength(1);
		expect(markup.match(/i-chev-r/g)).toHaveLength(2);
	});
});
