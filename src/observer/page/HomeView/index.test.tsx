import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListing, ProjectView } from "@/observer/types/index.js";
import type { RunningWork, SessionSummary, Status, WaitingFile } from "@/types/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";
import type { StreamState } from "@/observer/page/types/index.js";
import useObserverStream from "@/observer/page/useObserverStream/index.js";
import HomeView from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

vi.mock("@/observer/page/useObserverStream/index.js", () => ({ default: vi.fn() }));

const ROUTE = { kind: "home", token: "tok" } as const;
const stamp = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

function project(projectKey: string, overrides: Partial<ProjectListing> = {}): ProjectListing {
	return { projectKey, projectRoot: `/work/${projectKey.replace(/-[0-9a-f]{6}$/, "")}`, sessions: [], lastEventAt: stamp(5), ...overrides };
}

function summary(sessionId: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
	return { sessionId, startedAt: stamp(60), lastEventAt: stamp(5), eventCount: 9, pid: 1, liveness: makeLiveness({ state: "ended" }), reported: null, ...overrides };
}

function ready(projectKey: string, { sessions = [], waiting = [], working = [] }: { sessions?: SessionSummary[]; waiting?: WaitingFile[]; working?: RunningWork[] }): ProjectView {
	const status: Status = {
		projectRoot: `/work/${projectKey}`,
		generatedAt: stamp(0),
		tree: [],
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions,
		running: working,
		waiting,
		surfaced: waiting[0] ?? null,
		rails: [],
		history: [],
		board: { state: "unavailable", reason: "no-brain-path", detail: "", hint: "" },
		problems: [],
	};
	return { state: "ready", projectKey, status };
}

function stream(overrides: Partial<StreamState>): void {
	vi.mocked(useObserverStream).mockReturnValue({ connection: "live", held: [], views: {}, listings: {}, projects: [], ...overrides });
}

function render(): string {
	return renderToStaticMarkup(
		<ThemeContext.Provider value={{ theme: "dark", toggle: () => undefined }}>
			<HomeView route={ROUTE} />
		</ThemeContext.Provider>,
	);
}

beforeEach(() => {
	vi.mocked(useObserverStream).mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("HomeView", () => {
	it("asks the all-projects stream with the link's token", () => {
		stream({});
		render();
		expect(useObserverStream).toHaveBeenCalledWith({ token: "tok" });
	});

	it("draws the header with the brand, the subtitle, the pill and the theme button, and a main region the skip link targets", () => {
		stream({});
		const html = render();
		expect(html).toContain('<a class="av-skip" href="#main">Skip to main content</a>');
		expect(html).toContain('<div class="av-hdr-meta">On this machine (127.0.0.1)</div>');
		expect(html).toContain('<span class="av-conn idle">');
		expect(html).toContain('aria-label="Switch to light theme"');
		expect(html).toContain('<main id="main" class="av-home">');
	});

	it("shows the empty notice with the install command once the project list is known to be empty", () => {
		stream({ projects: [] });
		const html = render();
		expect(html).toContain('<div class="av-notice calm" style="margin-top:24px">');
		expect(stripMarkup(html)).toContain("Nothing recorded yet");
		expect(stripMarkup(html)).toContain("Projects appear here as soon as an agent starts a session in a project that has AIDE installed.");
		expect(html).toContain('<div class="av-cmd">npx -y @aidemd-mcp/server@latest init</div>');
	});

	it("shows no empty notice, and no section, before the project list arrives", () => {
		stream({ projects: null, connection: "connecting" });
		const html = render();
		expect(html).not.toContain("Nothing recorded yet");
		expect(html).not.toContain("av-sect");
	});

	it("has no waiting section and no live-sessions list: a gate shows as the floating button, a live session as the project's own count", () => {
		const waiting: WaitingFile = { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 2, since: stamp(6) };
		stream({
			projects: [project("alpha-111111")],
			views: { "alpha-111111": ready("alpha", { sessions: [summary("s1", { liveness: makeLiveness() })], waiting: [waiting] }) },
		});
		const html = render();
		expect(html).not.toContain("h-wait");
		expect(html).not.toContain("h-live");
		expect(stripMarkup(html)).not.toContain("Waiting on you 1");
		expect(stripMarkup(html)).not.toContain("Live sessions");
		expect(html).toContain('<div class="av-fab">');
		expect(stripMarkup(html)).toContain("1 waiting");
		expect(stripMarkup(html)).toContain("Projects 1");
		expect(html).toContain('<span class="av-conn live">');
	});

	it("draws no floating waiting button while no gate is open, and offers no project filter for few projects", () => {
		stream({ projects: [project("alpha-111111")], views: { "alpha-111111": ready("alpha", { sessions: [summary("s1")] }) } });
		const html = render();
		expect(html).not.toContain("av-fab");
		expect(html).not.toContain("Filter projects");
		expect(html).toContain('aria-expanded="false"');
	});

	it("orders projects by Activity by default, with the Custom order one button away", () => {
		stream({ projects: [project("alpha-111111")] });
		const html = render();
		expect(html).toContain('<div class="av-seg av-order" role="group" aria-label="Order projects by">');
		expect(html).toContain('<button type="button" aria-pressed="true">Activity</button>');
		expect(html).toContain('<button type="button" aria-pressed="false" title="Drag projects to reorder">Custom</button>');
	});

	it("lists every project under one list, with no Starred section, until the viewer stars one", () => {
		stream({ projects: [project("alpha-111111"), project("beta-222222")] });
		const html = render();
		expect(html).not.toContain("Starred");
		expect(html).not.toContain("All projects");
		expect(html.match(/class="av-list"/g)).toHaveLength(1);
		expect(html.match(/class="p-star"/g)).toHaveLength(2);
	});

	it("puts the projects the viewer starred in a Starred section above All projects", () => {
		vi.stubGlobal("window", { localStorage: { getItem: (key: string) => (key === "aide-viewer:starred-projects" ? JSON.stringify(["beta-222222"]) : null), setItem: () => undefined } });
		stream({ projects: [project("alpha-111111"), project("beta-222222")] });
		const html = render();
		const starred = html.indexOf("★ Starred");
		const rest = html.indexOf("All projects");
		expect(starred).toBeGreaterThan(-1);
		expect(starred).toBeLessThan(rest);
		expect(stripMarkup(html)).toContain("★ Starred 1");
		expect(stripMarkup(html)).toContain("All projects 1");
		expect(html.indexOf("beta")).toBeLessThan(rest);
		expect(html.lastIndexOf("alpha")).toBeGreaterThan(rest);
		expect(html).toContain('aria-label="Unstar beta"');
		expect(html).toContain('aria-label="Star alpha"');
	});

	it("starts every row closed, each with its Open project button", () => {
		stream({ projects: [project("alpha-111111")] });
		const html = render();
		expect(html).toContain('class="av-proj-h flat" aria-expanded="false"');
		expect(html).toContain("Open project");
		expect(html).not.toContain("av-proj-more");
	});

	it("offers the project filter field with an accessible name only past 6 projects", () => {
		stream({ projects: Array.from({ length: 7 }, (_, index) => project(`proj${index}-abcdef`)) });
		const html = render();
		expect(html).toContain('<span class="sr">Filter projects</span><input type="search" placeholder="Filter projects" value=""/>');
		expect(html).toContain('<label class="av-field" style="flex:0 1 300px">');
	});

	it("reads the pill as Reconnecting while the stream is down, with every project kept on screen", () => {
		stream({ connection: "reconnecting", projects: [project("alpha-111111")] });
		const html = render();
		expect(html).toContain('<span class="av-conn recon">');
		expect(stripMarkup(html)).toContain("Projects 1");
	});

	it("draws nothing until the stream first answers, so a rejected link never flashes a pill or data", () => {
		stream({ connection: "connecting", projects: [project("alpha-111111")] });
		expect(render()).toBe("");
	});

	it("shows only the invalid-link notice when the stream refuses the token: no pill, no data", () => {
		stream({ connection: "unauthorized", projects: [project("alpha-111111")] });
		const html = render();
		expect(stripMarkup(html)).toContain("This link is no longer valid");
		expect(html).not.toContain("av-conn");
		expect(html).not.toContain("av-sect");
	});
});
