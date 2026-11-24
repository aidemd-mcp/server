import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import WaitBanner from "./index.js";

describe("WaitBanner", () => {
	const html = renderToStaticMarkup(<WaitBanner file="plan.aide" module="src/tools/score" since="2m" />);

	it("is a status region in the handoff's amber banner markup", () => {
		expect(html).toContain('<div class="av-wait-banner" role="status">');
		expect(html).toContain('<span class="w-k"><span class="ic xl i-wait" aria-hidden="true"></span>Waiting on you</span>');
		expect(html).toContain('<span class="w-what">approve <span class="mono">plan.aide</span> for <span class="mono">src/tools/score</span></span>');
	});

	it("says what waits and that this page cannot approve", () => {
		const text = stripMarkup(html);
		expect(text).toContain("Waiting on you");
		expect(text).toContain("approve plan.aide for src/tools/score");
		expect(text).toContain("The agent is paused until you answer in its session. This page only shows status — it can't approve.");
	});

	it("hides the ticking since span from the status region", () => {
		expect(html).toContain('<span class="w-since" aria-hidden="true">since 2m</span>');
	});

	it("offers no control", () => {
		expect(html).not.toContain("<button");
	});
});
