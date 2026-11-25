import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/shared/useFetched/index.js", () => ({ default: vi.fn() }));

import useFetched from "@/observer/page/shared/useFetched/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import ArchivedList from "./index.js";

const NOW = new Date(2026, 10, 23, 15, 0, 0);

function render(): string {
	return renderToStaticMarkup(<ArchivedList now={NOW} token="t" projectKey="p" version={0} onChanged={() => undefined} />);
}

function listing(sessionId: string, hour: number) {
	return {
		sessionId,
		startedAt: new Date(2026, 10, 22, hour, 0, 0).toISOString(),
		metadata: null,
		eventCount: 3,
		lastEventAt: new Date(2026, 10, 22, hour, 5, 0).toISOString(),
		live: false,
	};
}

beforeEach(() => {
	vi.mocked(useFetched).mockReset();
});

describe("ArchivedList", () => {
	it("says it is loading while the archive is fetched", () => {
		vi.mocked(useFetched).mockReturnValue({ state: "loading" });
		expect(stripMarkup(render())).toContain("Loading archived sessions");
	});

	it("shows the observer's message when the fetch fails", () => {
		vi.mocked(useFetched).mockReturnValue({ state: "error", message: "The observer could not be reached." });
		expect(stripMarkup(render())).toContain("The observer could not be reached.");
	});

	it("says so when nothing is archived", () => {
		vi.mocked(useFetched).mockReturnValue({ state: "ready", data: { sessions: [] } });
		expect(stripMarkup(render())).toContain("No archived sessions.");
	});

	it("draws each archived session newest first with Restore and Delete permanently, and no confirmation", () => {
		vi.mocked(useFetched).mockReturnValue({ state: "ready", data: { sessions: [listing("a", 9), listing("b", 17)] } });

		const html = render();

		expect(html.match(/>Restore<\/button>/g)).toHaveLength(2);
		expect(stripMarkup(html).match(/Delete permanently/g)).toHaveLength(2);
		expect(html).not.toContain(">Archive<");
		expect(html).not.toContain("av-confirm");
		const text = stripMarkup(html);
		expect(text.indexOf("Yesterday 17:00")).toBeLessThan(text.indexOf("Yesterday 09:00"));
	});
});
