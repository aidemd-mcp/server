import type { FixtureModule, FixturePlan, FixtureTodo } from "@/observer/seedFixtures/types/index.js";

/** The handoff's plan chip `P(status, done, total)`. */
function plan(status: FixturePlan["status"], done: number, total: number): FixturePlan {
	return { status, done, total };
}

/** The handoff's todo chip `TD(open, total)`: `proposed` while items are open, else `completed`. */
function todo(open: number, total: number): FixtureTodo {
	return { status: open > 0 ? "proposed" : "completed", open, total };
}

/** The handoff's base tree (`treeData` without `large`): 14 modules, root first. */
const BASE: FixtureModule[] = [
	{ path: "", desc: "aidemd-mcp — the AIDE methodology as an MCP server and CLI", alignment: "aligned", brief: true },
	{ path: "src/tools", desc: "MCP tool handlers that agents call", alignment: "aligned" },
	{
		path: "src/tools/score",
		desc: "Ranks specs by alignment and open work so the next agent knows where to start",
		alignment: "aligned",
		brief: true,
		research: true,
	},
	{
		path: "src/tools/validate",
		desc: "Checks that specs exist and their frontmatter is complete",
		alignment: "misaligned",
		brief: true,
		plan: plan("completed", 6, 6),
		todo: todo(3, 5),
	},
	{ path: "src/tools/scaffold", desc: "Creates a spec folder with starter intent and brief", alignment: "unreviewed", brief: true },
	{ path: "src/service", desc: "Long-lived services behind the tools", alignment: "aligned" },
	{
		path: "src/service/install",
		desc: "Writes AIDE files into a project and wires the MCP config",
		alignment: "aligned",
		brief: true,
		plan: plan("completed", 9, 9),
	},
	{
		path: "src/service/events",
		desc: "Appends pipeline events that the viewer reads",
		alignment: "aligned",
		brief: true,
		research: true,
		plan: plan("proposed", 0, 7),
	},
	{ path: "src/service/brain", desc: "Reads and writes the kanban brain folder", alignment: "unreviewed", research: true },
	{ path: "src/cli", desc: "Command-line entry points", alignment: "aligned" },
	{
		path: "src/cli/init",
		desc: "Interactive setup: project root, kanban tag, brain folder",
		alignment: "aligned",
		brief: true,
		plan: plan("abandoned", 2, 8),
		todo: todo(1, 2),
	},
	{ path: "src/viewer", desc: "Local pipeline viewer: server and page", alignment: "unreviewed" },
	{
		path: "src/viewer/server",
		desc: "Serves the page on 127.0.0.1 and streams events",
		alignment: "aligned",
		brief: true,
		plan: plan("approved", 6, 9),
		todo: todo(0, 2),
	},
	{ path: "src/viewer/page", desc: "The page this design describes", alignment: "unreviewed", brief: true, research: true },
];

/** The handoff's `src/tools/*` additions: next … export, in its order. */
const TOOLS_EXTRA: FixtureModule[] = [
	{ path: "src/tools/next", desc: "Suggests the next module to work on", alignment: "unreviewed", brief: true },
	{
		path: "src/tools/status",
		desc: "Summarises pipeline state for an agent",
		alignment: "aligned",
		brief: true,
		plan: plan("proposed", 0, 6),
	},
	{ path: "src/tools/retro", desc: "Collects retro notes from closed todos", alignment: "aligned", brief: true },
	{
		path: "src/tools/align",
		desc: "Compares code against intent and flags drift",
		alignment: "misaligned",
		brief: true,
		todo: todo(2, 4),
	},
	{ path: "src/tools/tree", desc: "Returns the intent tree as JSON", alignment: "aligned", brief: true },
	{ path: "src/tools/search", desc: "Full-text search across specs", alignment: "aligned", brief: true },
	{ path: "src/tools/diff", desc: "Shows spec changes since a commit", alignment: "unreviewed", brief: true },
	{ path: "src/tools/graph", desc: "Dependency graph between modules", alignment: "aligned", brief: true },
	{ path: "src/tools/export", desc: "Exports specs as a single markdown file", alignment: "aligned", brief: true },
];

/** The handoff's `src/service/*` additions: watch … paths, in its order. */
const SERVICE_EXTRA: FixtureModule[] = [
	{
		path: "src/service/watch",
		desc: "Watches .aide files and pushes tree changes",
		alignment: "aligned",
		brief: true,
		todo: todo(1, 3),
	},
	{ path: "src/service/cache", desc: "Caches parsed specs between calls", alignment: "aligned", brief: true },
	{ path: "src/service/config", desc: "Loads and merges project config", alignment: "aligned", brief: true },
	{ path: "src/service/log", desc: "Structured logging for agents and server", alignment: "aligned", brief: true },
	{ path: "src/service/git", desc: "Reads commits and tags for release events", alignment: "misaligned", brief: true },
	{ path: "src/service/lock", desc: "Prevents two writers on one session file", alignment: "aligned", brief: true },
	{
		path: "src/service/paths",
		desc: "Resolves project root and brain paths",
		alignment: "aligned",
		brief: true,
		plan: plan("approved", 2, 5),
	},
];

/** The handoff's `src/domain/*` children: intent … slug, in its order, with `Parses and models …` descriptions. */
const DOMAIN_CHILDREN: FixtureModule[] = [
	{ path: "src/domain/intent", desc: "Parses and models intent files", alignment: "aligned", brief: true },
	{
		path: "src/domain/plan",
		desc: "Parses and models plan files and numbered steps",
		alignment: "aligned",
		brief: true,
		plan: plan("approved", 1, 3),
	},
	{ path: "src/domain/todo", desc: "Parses and models todo issues and retros", alignment: "aligned", brief: true },
	{ path: "src/domain/brief", desc: "Parses and models briefs", alignment: "aligned", brief: true },
	{ path: "src/domain/frontmatter", desc: "Parses and models spec frontmatter", alignment: "aligned", brief: true },
	{ path: "src/domain/alignment", desc: "Parses and models alignment status", alignment: "aligned", brief: true },
	{ path: "src/domain/progress", desc: "Parses and models plan and todo progress", alignment: "aligned", brief: true },
	{ path: "src/domain/slug", desc: "Parses and models task slugs", alignment: "aligned", brief: true },
];

/** The modules the handoff's `large` tree adds, in its order: tools, service, cli, domain, viewer, test. */
const EXTRA: FixtureModule[] = [
	...TOOLS_EXTRA,
	...SERVICE_EXTRA,
	{ path: "src/cli/doctor", desc: "Checks an install and prints what to fix", alignment: "unreviewed", brief: true },
	{
		path: "src/cli/upgrade",
		desc: "Migrates older .aide layouts",
		alignment: "aligned",
		brief: true,
		plan: plan("completed", 4, 4),
	},
	{ path: "src/domain", desc: "Pure parsing and ranking logic, no I/O", alignment: "aligned" },
	...DOMAIN_CHILDREN,
	{ path: "src/viewer/auth", desc: "Access links and their expiry", alignment: "aligned", brief: true },
	{
		path: "src/viewer/stream",
		desc: "Reconnect and replay after a server restart",
		alignment: "aligned",
		brief: true,
		plan: plan("completed", 5, 5),
	},
	{ path: "test", desc: "Golden fixtures and integration tests", alignment: "aligned" },
	{ path: "test/fixtures", desc: "Sample projects used by tests", alignment: "aligned", brief: true },
	{ path: "test/e2e", desc: "End-to-end runs of the pipeline", alignment: "aligned", brief: true },
	{ path: "test/golden", desc: "Golden outputs for parsers", alignment: "aligned", brief: true },
];

/** The handoff's module list (`treeData`): the 14 base modules, plus the 33 extra ones (47 in all) when `large`. */
export default function moduleTable({ large }: { large: boolean }): FixtureModule[] {
	return large ? [...BASE, ...EXTRA] : [...BASE];
}
