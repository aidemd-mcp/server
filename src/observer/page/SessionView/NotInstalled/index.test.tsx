import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import NotInstalled from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

const NOW = new Date();
const session: SessionRowModel = {
	sessionId: "s1",
	startedAt: new Date(NOW.getTime() - 3 * 60_000).toISOString(),
	lastEventAt: NOW.toISOString(),
	eventCount: 2,
	liveness: makeLiveness(),
	task: null,
	label: null,
};

describe("NotInstalled", () => {
	const html = renderToStaticMarkup(
		<NotInstalled projectRoot="/work/app" sessions={[session]} now={NOW} token="tok" projectKey="app-abc123" routeSessionId="s1" />,
	);

	it("explains what is missing, with the reported folder and the install command", () => {
		expect(stripMarkup(html)).toContain(
			"AIDE isn't installed in this project yetThis session reported /work/app, but there's no .aide/intent.aide there, so there's no pipeline or intent tree to show. Run this in the project root:npx -y @aidemd-mcp/server@latest initWhen the next phase starts, this page fills in by itself.",
		);
		expect(html).toContain('<div class="av-cmd">npx -y @aidemd-mcp/server@latest init</div>');
	});

	it("lists the project's sessions with their count", () => {
		expect(stripMarkup(html)).toContain("Sessions 1");
		expect(html).toContain('class="av-srow live"');
	});

	it("is the page's main region", () => {
		expect(html).toContain('<main id="main"');
	});
});
