import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TaskCardModel } from "@/observer/page/types/index.js";
import TaskCard from "./index.js";

const TASK: TaskCardModel = { slug: "aide-score-rank", title: "aide_score ranks misaligned specs lower", priority: "p1", type: "bug", linked: false, unreadable: null };

describe("TaskCard", () => {
	it("draws a button with the title, the slug and the priority and type as words", () => {
		const html = renderToStaticMarkup(<TaskCard task={TASK} onOpen={() => undefined} />);
		expect(html).toBe(
			'<button type="button" class="av-task"><span class="t-title">aide_score ranks misaligned specs lower</span><span class="t-slug">aide-score-rank</span><span class="t-tags"><span class="av-badge av-prio p1">p1</span><span class="av-badge neutral">bug</span></span></button>',
		);
	});

	it("outlines a linked task and badges it with the eye icon and the words This session", () => {
		const html = renderToStaticMarkup(<TaskCard task={{ ...TASK, linked: true }} onOpen={() => undefined} />);
		expect(html).toContain('<button type="button" class="av-task linked">');
		expect(html).toContain('<span class="av-badge run" style="align-self:flex-start"><span class="ic i-eye" aria-hidden="true"></span>This session</span>');
	});

	it.each(["p0", "p1", "p2", "p3"] as const)("words priority %s in its own badge", (priority) => {
		const html = renderToStaticMarkup(<TaskCard task={{ ...TASK, priority }} onOpen={() => undefined} />);
		expect(html).toContain(`<span class="av-badge av-prio ${priority}">${priority}</span>`);
	});

	it("leaves the type badge out when the note has none", () => {
		const html = renderToStaticMarkup(<TaskCard task={{ ...TASK, type: null }} onOpen={() => undefined} />);
		expect(html).not.toContain("neutral");
	});

	it("shows an Unreadable danger badge in place of priority and type, with the reason on the slug line", () => {
		const html = renderToStaticMarkup(
			<TaskCard task={{ slug: "broken", title: "broken", priority: null, type: null, linked: false, unreadable: "frontmatter is not YAML" }} onOpen={() => undefined} />,
		);
		expect(html).toContain('<span class="t-slug" title="frontmatter is not YAML">broken</span>');
		expect(html).toContain('<span class="av-badge danger"><span class="ic i-error" aria-hidden="true"></span>Unreadable</span>');
		expect(html).not.toContain("av-prio");
	});
});
