import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fetchTask from "@/observer/page/api/fetchTask/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { Fetched } from "@/observer/page/types/index.js";
import useFetched from "@/observer/page/shared/useFetched/index.js";
import TaskSummary from "./index.js";

vi.mock("@/observer/page/api/fetchTask/index.js", () => ({ default: vi.fn() }));
vi.mock("@/observer/page/shared/useFetched/index.js", () => ({ default: vi.fn() }));

type Note = Extract<Fetched<unknown>, { state: "ready" }>["data"];

const NOTE = [
	"# Fix the login bug",
	"",
	"## Goal",
	"Make **login** work.",
	"",
	"## Plan",
	"- step one",
].join("\n");

function ready(overrides: Record<string, unknown> = {}): Fetched<Note> {
	return {
		state: "ready",
		data: {
			slug: "fix-login",
			column: "in-progress",
			markdown: NOTE,
			task: { state: "readable", slug: "fix-login", column: "in-progress", title: "Fix the login bug", priority: "p1", type: "bug", tags: [], inSession: true },
			...overrides,
		},
	} as Fetched<Note>;
}

function render(onOpenHref: (href: string) => void = () => undefined): string {
	return renderToStaticMarkup(<TaskSummary token="tok" projectKey="app-abc123" slug="fix-login" title="Reported title" href="/p/app-abc123/s/s1?token=tok&item=task%3Afix-login" onOpenHref={onOpenHref} />);
}

beforeEach(() => {
	vi.mocked(useFetched).mockReset();
	vi.mocked(fetchTask).mockReset();
});

describe("TaskSummary", () => {
	it("reads the task note by project and slug, keyed so a different task refetches", async () => {
		vi.mocked(useFetched).mockReturnValue({ state: "loading" });
		vi.mocked(fetchTask).mockResolvedValue({ ok: false, message: "x" } as never);
		render();
		const call = vi.mocked(useFetched).mock.calls[0]![0];
		expect(call.key).toBe("app-abc123:fix-login");
		await call.load!();
		expect(fetchTask).toHaveBeenCalledWith({ token: "tok", projectKey: "app-abc123", slug: "fix-login" });
	});

	it("shows only the caption, the link and the reported title while the note loads", () => {
		vi.mocked(useFetched).mockReturnValue({ state: "loading" });
		const html = render();
		expect(stripMarkup(html)).toContain("Current task");
		expect(stripMarkup(html)).toContain("Open in project →");
		expect(html).toContain('<span class="pm-task-t">Reported title</span>');
		expect(html).not.toContain("pm-task-chips");
		expect(html).not.toContain("pm-secs");
	});

	it("falls back to the same short form when the note cannot be read", () => {
		vi.mocked(useFetched).mockReturnValue({ state: "error", message: "gone" });
		const html = render();
		expect(html).toContain('<span class="pm-task-t">Reported title</span>');
		expect(html).not.toContain("pm-task-chips");
		expect(html).not.toContain("pm-secs");
	});

	it("shows the note's title, the column label, priority and type as chips, and its sections collapsed with a preview", () => {
		vi.mocked(useFetched).mockReturnValue(ready());
		const html = render();
		expect(html).toContain('<span class="pm-task-t">Fix the login bug</span>');
		expect(html).toContain('<span class="av-badge neutral">In Progress</span>');
		expect(html).toContain('<span class="av-badge av-prio p1">p1</span>');
		expect(html).toContain('<span class="av-badge outline">bug</span>');
		expect(stripMarkup(html)).toContain("Task note");
		expect(html).toContain('<div class="pm-sec"><button type="button" class="pm-sec-h" aria-expanded="false">');
		expect(html).toContain('<span class="pm-sec-k">Goal</span><span class="pm-sec-p">Make login work.</span>');
		expect(html).toContain('<span class="pm-sec-k">Plan</span><span class="pm-sec-p">step one</span>');
		expect(html).not.toContain("pm-sec-b");
	});

	it("still shows the column and the sections when the note's frontmatter is unreadable, with the reported title", () => {
		vi.mocked(useFetched).mockReturnValue(ready({ task: { state: "unreadable", slug: "fix-login", column: "todo", reason: "bad", inSession: false } }));
		const html = render();
		expect(html).toContain('<span class="pm-task-t">Reported title</span>');
		expect(html).toContain('<span class="av-badge neutral">In Progress</span>');
		expect(html).not.toContain("av-prio");
		expect(html).toContain("pm-secs");
	});

	it("leaves out the type chip when the task has none, and the Task note part when the note has no sections", () => {
		vi.mocked(useFetched).mockReturnValue(
			ready({
				column: "done",
				markdown: "# Only a title\n",
				task: { state: "readable", slug: "fix-login", column: "done", title: "Only a title", priority: "p3", tags: [], inSession: false },
			}),
		);
		const html = render();
		expect(html).toContain('<span class="av-badge neutral">Done</span>');
		expect(html).not.toContain("av-badge outline");
		expect(html).not.toContain("Task note");
		expect(html).not.toContain("pm-secs");
	});
});
