import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { WaitCardModel } from "@/observer/page/types/index.js";
import WaitCard from "./index.js";

const CARD: WaitCardModel = {
	key: "k",
	project: "aidemd-site",
	file: "plan.aide",
	module: "src/pages/docs/score",
	since: "6m",
	at: "14:28",
	href: "/p/a/s/b?token=t",
};

describe("WaitCard", () => {
	it("is one real button in the handoff's amber card markup", () => {
		const html = renderToStaticMarkup(<WaitCard card={CARD} onOpen={() => undefined} />);
		expect(html).toContain('<button type="button" class="av-wait-card">');
		expect(html).toContain('<span class="ic xl i-wait" aria-hidden="true"></span>');
		expect(html).toContain('<span class="stack" style="gap:2px">');
		expect(html).toContain('<span class="wc-since">6m<span>waiting since 14:28</span></span>');
	});

	it("says who waits, on what, for which module, and to answer in the agent's session", () => {
		const text = stripMarkup(renderToStaticMarkup(<WaitCard card={CARD} onOpen={() => undefined} />));
		expect(text).toContain("Waiting on you · aidemd-site");
		expect(text).toContain("Approve plan.aide");
		expect(text).toContain("for src/pages/docs/score · answer in the agent's session to continue");
	});

	it("offers no approve or reject control", () => {
		const html = renderToStaticMarkup(<WaitCard card={CARD} onOpen={() => undefined} />);
		expect(html.match(/<button/g)).toHaveLength(1);
	});
});
