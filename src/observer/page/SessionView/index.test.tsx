import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleNode, RunningWork, SessionSummary, Status, WaitingFile } from "@/types/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";
import type { SessionRoute, SessionTab, StreamState } from "@/observer/page/types/index.js";
import useObserverStream from "@/observer/page/useObserverStream/index.js";
import SessionView from "./index.js";

vi.mock("@/observer/page/useObserverStream/index.js", () => ({ default: vi.fn() }));

const KEY = "app-abc123";
const stamp = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

function routeOf(overrides: Partial<SessionRoute> = {}): SessionRoute {
	return { kind: "session", token: "tok", projectKey: KEY, sessionId: "s1", tab: "tree", item: null, ...overrides };
}

const planNode: ModuleNode = {
	folder: "src/a",
	parent: ".",
	files: [
		{
			kind: "plan",
			file: "src/a/plan.aide",
			folder: "src/a",
			read: { state: "present", status: "approved", awaitingApproval: false, progress: { done: 1, total: 4, open: 3 }, steps: { done: 1, total: 4 } },
		},
	],
};

const gate: WaitingFile = { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 3, since: stamp(2) };
const build: RunningWork = {
	sessionId: "s1",
	phase: "build",
	agent: "aide-implementor",
	module: "src/a",
	startedAt: stamp(10),
	elapsedMs: 600_000,
	buildStep: { reached: 2, total: 4 },
};

function summary(sessionId: string, liveness: SessionSummary["liveness"] = "live"): SessionSummary {
	return { sessionId, startedAt: stamp(30), lastEventAt: stamp(1), eventCount: 4, pid: 1, liveness, reported: null };
}

function statusOf(overrides: Partial<Status> = {}): Status {
	return {
		projectRoot: "/work/app",
		generatedAt: new Date().toISOString(),
		tree: [planNode],
		workFiles: [],
		sessionRecord: { state: "missing" },
		sessions: [summary("s1")],
		running: [],
		waiting: [],
		surfaced: null,
		rail: null,
		history: [],
		board: { state: "unavailable", reason: "no-brain-path", detail: "", hint: "" },
		problems: [],
		...overrides,
	};
}

const events = [
	{ v: 1, pid: 1, seq: 1, ts: stamp(30), sessionId: "s1", kind: "session_started", kanbanTag: "app" },
	{ v: 1, pid: 1, seq: 2, ts: stamp(10), sessionId: "s1", kind: "phase_started", phase: "build", agent: "aide-implementor", module: "src/a" },
] as unknown as StreamState["held"][number]["events"];

function stream(overrides: Partial<StreamState> = {}): void {
	vi.mocked(useObserverStream).mockReturnValue({
		connection: "live",
		held: [{ projectKey: KEY, sessionId: "s1", events }],
		views: { [KEY]: { state: "ready", projectKey: KEY, status: statusOf({ running: [build] }) } },
		listings: {},
		projects: null,
		...overrides,
	});
}

function stubBrowser({ narrow }: { narrow: boolean }): void {
	vi.stubGlobal("window", {
		matchMedia: () => ({ matches: narrow, addEventListener: () => undefined, removeEventListener: () => undefined }),
	});
}

function render(route: SessionRoute): string {
	return renderToStaticMarkup(
		<ThemeContext.Provider value={{ theme: "dark", toggle: () => undefined }}>
			<SessionView route={route} setTab={(_: SessionTab) => undefined} openItem={() => undefined} closeItem={() => undefined} />
		</ThemeContext.Provider>,
	);
}

beforeEach(() => {
	vi.mocked(useObserverStream).mockReset();
	stubBrowser({ narrow: false });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SessionView", () => {
	it("asks the project's stream with the link's token and key", () => {
		stream();
		render(routeOf());
		expect(useObserverStream).toHaveBeenCalledWith({ token: "tok", projectKey: KEY });
	});

	it("lays out header, run bar, now section, tabs, bottom drawer and details column for a running Build on desktop", () => {
		stream();
		const html = render(routeOf());

		expect(html).toContain('<nav class="av-hnav" aria-label="Navigation">');
		expect(html).toContain('<span class="av-hnav-title">app</span>');
		expect(html).not.toContain("av-crumb");
		expect(html).toContain('<div class="av-runbar run" role="status">');
		expect(html).toContain('<section class="av-now" aria-label="Now running">');
		expect(html).toContain('class="av-card run"');
		expect(html).toContain("Step 2 of 4");
		expect(html).toContain('role="tablist" aria-label="Session views"');
		expect(html).toContain('role="tabpanel"');
		expect(html).toContain('<div class="av-drawer-bottom">');
		expect(html).toContain('<div class="av-sidepanel">');
		expect(html).toContain('<main id="main" class="av-primary">');
		expect(html).toContain("Skip to main content");
		expect(html).toContain('<div class="av-top"');
		expect(html).not.toContain("av-wait-banner");
		expect(html).not.toContain("av-quiet-banner");
		expect(html).not.toMatch(/class="av-drawer[ "]/);
		expect(html).not.toContain('<aside class="av-side"');
		expect(html.indexOf("av-runbar")).toBeLessThan(html.indexOf("av-main"));
		expect(html.indexOf("av-now")).toBeLessThan(html.indexOf("av-drawer-bottom"));
		// The bottom drawer sits after both columns, so it spans the page under the tree and Details.
		expect(html.indexOf("av-sidepanel")).toBeLessThan(html.indexOf("av-drawer-bottom"));
		expect(html.indexOf('<div class="av-drawer-bottom">')).toBeGreaterThan(html.lastIndexOf("</main>"));
	});

	it("keeps the header to a Projects button and the project's name, with no breadcrumb or path", () => {
		stream();
		const html = render(routeOf());
		const header = html.slice(html.indexOf('<header class="av-hdr">'), html.indexOf("</header>"));
		const text = stripMarkup(header);
		expect(text).toContain("Projects");
		expect(text).toContain("app");
		expect(text).not.toContain("/work/app");
		expect(text).not.toContain("kanban");
		expect(header).not.toContain("av-switch");
	});

	it("draws the bottom drawer's launchers with their counts, closed, and the details prompt", () => {
		stream();
		const html = render(routeOf());
		expect(html).toContain('role="tablist" aria-label="Bottom drawer"');
		for (const label of ["History", "Sessions", "Board"]) expect(stripMarkup(html)).toContain(label);
		expect(html).toContain('<div class="av-side-empty">');
		expect(stripMarkup(html)).toContain("Click a module, plan, task or history event to read it here.");
	});

	it("draws History as its own phone column in place of the bottom drawer, without a run bar", () => {
		stubBrowser({ narrow: true });
		stream();
		const html = render(routeOf());
		expect(html).toContain('<aside class="av-side" aria-label="History">');
		expect(html).not.toContain("av-drawer-bottom");
		expect(html).not.toContain("av-sidepanel");
		expect(html).not.toContain("av-runbar");
	});

	describe("the waiting banner", () => {
		it("is absent when no gate is open", () => {
			stream();
			expect(render(routeOf())).not.toContain("av-wait-banner");
		});

		it("replaces the run bar and the now card while a gate is open, since the banner says it", () => {
			stream({ views: { [KEY]: { state: "ready", projectKey: KEY, status: statusOf({ waiting: [gate], surfaced: gate }) } } });
			const html = render(routeOf());
			expect(html).not.toContain("av-runbar");
			expect(html).not.toContain('class="av-card');
			expect(html).toContain('<div class="av-wait-hint">');
		});

		it("opens the body when a gate is open, with its open button", () => {
			stream({ views: { [KEY]: { state: "ready", projectKey: KEY, status: statusOf({ waiting: [gate], surfaced: gate }) } } });
			const html = render(routeOf());
			const banner = html.indexOf('class="av-wait-banner"');

			expect(banner).toBeGreaterThan(html.indexOf('class="av-body"'));
			expect(banner).toBeLessThan(html.indexOf("av-now"));
			const text = stripMarkup(html);
			expect(text).toContain("approve plan.aide for src/a");
			expect(text).toContain("Open plan.aide");
		});
	});

	it("keeps everything on screen while reconnecting, with the quiet banner and the pill", () => {
		stream({ connection: "reconnecting" });
		const html = render(routeOf());

		expect(html).toContain('<div class="av-quiet-banner" role="status">');
		expect(html).toContain('class="av-conn recon"');
		expect(stripMarkup(html)).toContain("Last update");
		expect(html).toContain('class="av-card run"');
		expect(html).toContain('<div class="av-drawer-bottom">');
		expect(html).not.toContain('role="alert"');
	});

	it("shows the install notice and the sessions, with no pipeline, when the folder holds no AIDE file", () => {
		stream({ views: { [KEY]: { state: "ready", projectKey: KEY, status: statusOf({ tree: [] }) } } });
		const html = render(routeOf());
		const text = stripMarkup(html);

		expect(text).toContain("AIDE isn't installed in this project yet");
		expect(text).toContain("This session reported /work/app");
		expect(html).toContain('<div class="av-cmd">npx -y @aidemd-mcp/server@latest init</div>');
		expect(text).toContain("Sessions 1");
		expect(html).not.toContain("av-now");
		expect(html).not.toContain('role="tablist"');
	});

	describe("a project with no reported root", () => {
		const noRoot = (): void =>
			stream({
				views: { [KEY]: { state: "no-project-root", projectKey: KEY, detail: "nobody reported a root" } },
				listings: { [KEY]: [{ sessionId: "s1", startedAt: stamp(30), metadata: null, eventCount: 2, lastEventAt: stamp(1), live: true }] },
			});

		it.each([
			["tree", "Intent tree unavailable"],
			["plans", "Plans and todos unavailable"],
			["board", "Board unavailable"],
		] as const)("shows a calm unavailable notice on the %s tab", (tab, heading) => {
			noRoot();
			stubBrowser({ narrow: tab !== "tree" });
			const html = render(routeOf({ tab }));
			expect(stripMarkup(html)).toContain(heading);
			expect(html).toContain("av-notice calm");
			expect(html).not.toContain("av-notice err");
		});

		it("keeps the card, rail, history and sessions working from events", () => {
			noRoot();
			stubBrowser({ narrow: true });
			const html = render(routeOf({ tab: "sessions" }));
			expect(html).toContain('class="av-card run"');
			expect(html).toContain("Pipeline phases");
			expect(html).toContain('<aside class="av-side"');
			expect(html).toContain('class="av-srow live"');
		});
	});

	it("shows one calm notice and no live data for a session the observer has no recording of", () => {
		stream({ connection: "not-found", held: [], views: {} });
		const html = render(routeOf());

		expect(stripMarkup(html)).toContain("Session not found");
		expect(html).toContain("All projects");
		expect(html).not.toContain("av-conn");
		expect(html).not.toContain("av-now");
		expect(html).not.toContain("av-side");
	});

	it("draws nothing until the stream first answers, so a rejected link never flashes a pill or rail", () => {
		stream({ connection: "connecting" });
		expect(render(routeOf())).toBe("");
	});

	it("shows the invalid-link screen, with no pill, rail or data, for a rejected token", () => {
		stream({ connection: "unauthorized" });
		const html = render(routeOf());

		expect(stripMarkup(html)).toContain("This link is no longer valid");
		expect(html).not.toContain("av-conn");
		expect(html).not.toContain("av-rail");
		expect(html).not.toContain("av-side");
	});

	it("docks the detail in the Details column on desktop when the link carries one, as a docked drawer, not an overlay", () => {
		stream();
		const html = render(routeOf({ item: { kind: "task", slug: "fix-it" } }));

		expect(html).toContain('<div class="av-sidepanel">');
		expect(html).toContain("fix-it");
		expect(html).not.toContain("av-side-empty");
		expect(html).toContain('class="av-drawer docked"');
		expect(html).not.toContain('class="av-drawer"');
		expect(html).toContain('class="av-card run"');
	});

	it("opens the drawer, non-modal, over the page on a phone when the link carries a detail", () => {
		stubBrowser({ narrow: true });
		stream();
		const html = render(routeOf({ tab: "plans", item: { kind: "task", slug: "fix-it" } }));

		expect(html).toContain('<aside class="av-drawer" role="dialog" aria-modal="false"');
		expect(html).toContain("fix-it");
		expect(html).toContain('class="av-card run"');
	});

	describe("the tab named in the link", () => {
		it("selects the intent tree and draws its panel on desktop", () => {
			stream();
			const html = render(routeOf({ tab: "tree" }));
			expect(html).toContain('role="tree"');
			expect(html).toContain('id="tab-tree" aria-selected="true"');
		});

		it.each(["plans", "board", "record", "sessions"] as const)("shows the tree for the %s tab on desktop, where it is no tab but a panel of the page", (tab) => {
			stream();
			const html = render(routeOf({ tab }));
			expect(html).toContain('role="tree"');
			expect(html).toContain('id="tab-tree" aria-selected="true"');
			expect(html).toContain('class="only-phone"');
		});

		it.each([
			["plans", 'role="table"'],
			["board", "Board unavailable"],
			["sessions", "av-srow"],
		] as const)("selects %s and draws its panel on a phone", (tab, marker) => {
			stubBrowser({ narrow: true });
			stream();
			const html = render(routeOf({ tab }));
			expect(html).toContain(marker);
			expect(html).toContain(`id="tab-${tab}" aria-selected="true"`);
		});

		it("shows the tree for the record link even on a phone, since the record is no tab", () => {
			stubBrowser({ narrow: true });
			stream();
			const html = render(routeOf({ tab: "record" }));
			expect(html).toContain('id="tab-tree" aria-selected="true"');
			expect(html).not.toContain("No session record");
		});

		it("draws the sessions tab's project info above the list on a phone", () => {
			stubBrowser({ narrow: true });
			stream();
			const html = render(routeOf({ tab: "sessions" }));
			expect(html).toContain('<div class="av-projinfo">');
			expect(stripMarkup(html)).toContain("/work/app");
		});

		it("lists only the intent tree as a desktop tab, the rest being phone-only", () => {
			stream();
			const html = render(routeOf());
			expect(html.match(/class="only-phone"/g)).toHaveLength(4);
			expect(html).toContain('id="tab-tree" aria-selected="true" aria-controls="session-panel">');
		});

		it("shows the tree for the History tab on desktop, where History is its own column", () => {
			stream();
			const html = render(routeOf({ tab: "history" }));
			expect(html).toContain('role="tree"');
			expect(html).toContain('id="tab-tree" aria-selected="true"');
		});

		it("selects History with an empty panel on a phone, where History is the tab", () => {
			stubBrowser({ narrow: true });
			stream();
			const html = render(routeOf({ tab: "history" }));
			expect(html).toContain('id="tab-history" aria-selected="true"');
			expect(html).toContain('<div class="av-panel" role="tabpanel" id="session-panel" aria-labelledby="tab-history"></div>');
		});
	});
});
