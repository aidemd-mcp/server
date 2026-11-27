import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolvePresenceFile from "@/util/runtimePaths/resolvePresenceFile/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import touchPresence from "@/service/observer/event/touchPresence/index.js";
import hook from "./index.js";

// The real touchPresence by default, so a test can swap one call for a mock or a throw.
vi.mock("@/service/observer/event/touchPresence/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/service/observer/event/touchPresence/index.js")>();
	return { default: vi.fn(actual.default) };
});

const CLAUDE = "claude-aaaa";
const OBSERVER = "20261125T100000000Z-abc123";
const OBSERVER_TOOL = "mcp__aide__aide_observer_event";

let appData: string;
let projectRoot: string;
let projectKey: string;
let stdoutWrite: MockInstance<typeof process.stdout.write>;
let stderrWrite: MockInstance<typeof process.stderr.write>;

function stdinOf(input: unknown): Readable {
	return Readable.from([typeof input === "string" ? input : JSON.stringify(input)]);
}

function makeInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return { session_id: CLAUDE, hook_event_name: "UserPromptSubmit", cwd: projectRoot, ...overrides };
}

function makeTaggedReply(): Record<string, unknown> {
	return {
		content: [{ type: "text", text: `{"logged":"written"}\n[observer-session ${OBSERVER}]` }],
	};
}

async function readStored(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(resolvePresenceFile({ projectKey, claudeSessionId: CLAUDE }), "utf-8"));
}

async function run(input: unknown, at = "2026-11-25T10:00:10.000Z"): Promise<void> {
	await hook({ stdin: stdinOf(input), env: {}, now: () => new Date(at) });
}

beforeEach(async () => {
	appData = await mkdtemp(path.join(tmpdir(), "aide-hook-appdata-"));
	projectRoot = await mkdtemp(path.join(tmpdir(), "aide-hook-project-"));
	vi.stubEnv("AIDEMD_HOME", path.join(appData, "aidemd"));
	projectKey = resolve({ projectRoot }).projectKey;
	stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
	stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
});

afterEach(async () => {
	stdoutWrite.mockRestore();
	stderrWrite.mockRestore();
	vi.mocked(touchPresence).mockClear();
	vi.unstubAllEnvs();
	await rm(appData, { recursive: true, force: true });
	await rm(projectRoot, { recursive: true, force: true });
});

describe("hook", () => {
	it("writes linked working presence for a tagged aide_observer_event reply", async () => {
		await run(
			makeInput({
				hook_event_name: "PostToolUse",
				tool_name: OBSERVER_TOOL,
				tool_response: makeTaggedReply(),
				transcript_path: "/t/a.jsonl",
			}),
		);

		expect(await readStored()).toMatchObject({
			claudeSessionId: CLAUDE,
			state: "working",
			hookEvent: "PostToolUse",
			sessionId: OBSERVER,
			transcriptPath: "/t/a.jsonl",
			at: "2026-11-25T10:00:10.000Z",
		});
	});

	it("passes the mapped call to touchPresence", async () => {
		await run(makeInput({ hook_event_name: "Stop" }));

		expect(touchPresence).toHaveBeenCalledWith({
			projectRoot,
			claudeSessionId: CLAUDE,
			hookEvent: "Stop",
			state: "waiting",
			at: "2026-11-25T10:00:10.000Z",
			transcriptPath: undefined,
			linkSessionId: undefined,
			endsObserverSession: false,
		});
	});

	it("prefers CLAUDE_PROJECT_DIR over the input cwd", async () => {
		await hook({
			stdin: stdinOf(makeInput({ cwd: "/somewhere/else" })),
			env: { CLAUDE_PROJECT_DIR: projectRoot },
			now: () => new Date("2026-11-25T10:00:10.000Z"),
		});

		expect(vi.mocked(touchPresence).mock.calls[0][0].projectRoot).toBe(projectRoot);
	});

	it("writes waiting presence for Stop", async () => {
		await run(makeInput({ hook_event_name: "Stop" }));

		expect(await readStored()).toMatchObject({ state: "waiting", hookEvent: "Stop" });
	});

	it("writes ended presence and the ended mark for SessionEnd once linked", async () => {
		await run(
			makeInput({ hook_event_name: "PostToolUse", tool_name: OBSERVER_TOOL, tool_response: makeTaggedReply() }),
		);
		await run(makeInput({ hook_event_name: "SessionEnd", reason: "other" }), "2026-11-25T10:05:00.000Z");

		expect(await readStored()).toMatchObject({ state: "ended", hookEvent: "SessionEnd", sessionId: OBSERVER });
		expect(existsSync(resolveEndedMark({ projectKey, id: OBSERVER }))).toBe(true);
	});

	it("writes ended presence but no mark for SessionEnd with reason clear", async () => {
		await run(
			makeInput({ hook_event_name: "PostToolUse", tool_name: OBSERVER_TOOL, tool_response: makeTaggedReply() }),
		);
		await run(makeInput({ hook_event_name: "SessionEnd", reason: "clear" }), "2026-11-25T10:05:00.000Z");

		expect(await readStored()).toMatchObject({ state: "ended" });
		expect(existsSync(resolveEndedMark({ projectKey, id: OBSERVER }))).toBe(false);
	});

	it("keeps the earlier observer link when a resumed Claude session relinks to a later observer session", async () => {
		const LATER = "20261125T110000000Z-def456";
		const taggedReplyFor = (id: string): Record<string, unknown> => ({
			content: [{ type: "text", text: `{"logged":"written"}\n[observer-session ${id}]` }],
		});

		await run(
			makeInput({ hook_event_name: "PostToolUse", tool_name: OBSERVER_TOOL, tool_response: taggedReplyFor(OBSERVER) }),
		);
		await run(makeInput({ hook_event_name: "SessionStart", source: "resume" }), "2026-11-25T10:30:00.000Z");
		await run(
			makeInput({ hook_event_name: "PostToolUse", tool_name: OBSERVER_TOOL, tool_response: taggedReplyFor(LATER) }),
			"2026-11-25T11:00:10.000Z",
		);

		expect(await readStored()).toMatchObject({ sessionId: LATER, earlierSessionIds: [OBSERVER] });
		expect(await readdir(projectRoot)).toEqual([]);
	});

	it("writes nothing under the project root", async () => {
		await run(makeInput({ hook_event_name: "Stop" }));

		expect(await readdir(projectRoot)).toEqual([]);
	});

	it.each([
		["malformed JSON", "{not json"],
		["a missing session_id", { hook_event_name: "Stop", cwd: "/x" }],
		["a session_id with a path separator", { session_id: "../evil", hook_event_name: "Stop", cwd: "/x" }],
		["an unknown event", { session_id: CLAUDE, hook_event_name: "PreToolUse", cwd: "/x" }],
		["no resolvable root", { session_id: CLAUDE, hook_event_name: "Stop" }],
	])("does nothing for %s and prints nothing", async (_name, input) => {
		await hook({ stdin: stdinOf(input), env: {}, now: () => new Date() });

		expect(touchPresence).not.toHaveBeenCalled();
		expect(stdoutWrite).not.toHaveBeenCalled();
		expect(stderrWrite).not.toHaveBeenCalled();
	});

	it("resolves within the deadline on a never-ending stdin, printing nothing", async () => {
		const stdin = new PassThrough();
		const started = Date.now();

		await hook({ stdin, env: {}, now: () => new Date() });

		expect(Date.now() - started).toBeLessThan(1500);
		expect(stdoutWrite).not.toHaveBeenCalled();
		expect(stderrWrite).not.toHaveBeenCalled();
		stdin.destroy();
	});

	it("resolves quietly when touchPresence throws", async () => {
		vi.mocked(touchPresence).mockRejectedValueOnce(new Error("boom"));

		await expect(run(makeInput())).resolves.toBeUndefined();

		expect(stdoutWrite).not.toHaveBeenCalled();
		expect(stderrWrite).not.toHaveBeenCalled();
	});
});

describe("hook import graph (brief commitment #103)", () => {
	const SRC = path.resolve(__dirname, "../..");
	const FORBIDDEN = [
		"@modelcontextprotocol/sdk",
		"ink",
		"react",
		"yaml",
		"@/tools/",
		"@/observer/",
		"@/service/observer/status",
		"@/service/observer/kanban",
	];
	// Runtime imports only: `import type` is erased and loads nothing.
	const SPECIFIER =
		/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^'";]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

	function isForbidden(specifier: string): boolean {
		return FORBIDDEN.some((name) =>
			name.endsWith("/") ? specifier.startsWith(name) : specifier === name || specifier.startsWith(`${name}/`),
		);
	}

	function resolveSource(specifier: string, from: string): string | null {
		const base = specifier.startsWith("@/")
			? path.join(SRC, specifier.slice(2))
			: specifier.startsWith(".")
				? path.resolve(path.dirname(from), specifier)
				: null;
		if (base === null) return null;
		const stem = base.replace(/\.js$/, "");
		const candidates = [`${stem}.ts`, `${stem}.tsx`, path.join(stem, "index.ts"), path.join(stem, "index.tsx")];
		return candidates.find((candidate) => existsSync(candidate)) ?? null;
	}

	// A static ESM import of an http builtin builds its ESM namespace, which loads undici and worker_threads.
	const HTTP_BUILTIN = /^(?:node:)?https?$/;

	// `zod` itself or any `zod/...` subpath: zod costs about 30-50 ms of every hook run (brief commitment #150).
	const ZOD_SPECIFIER = /^zod(?:\/|$)/;

	// A call of the global client: `fetch(` not preceded by `.`, a word character or `$`.
	const GLOBAL_FETCH = /(?<![.\w$])fetch\s*\(/;

	function stripComments(source: string): string {
		return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
	}

	function walk(entry: string): {
		files: Set<string>;
		forbidden: string[];
		fetchCalls: string[];
		httpImports: string[];
		zodImports: string[];
	} {
		const files = new Set<string>();
		const forbidden: string[] = [];
		const fetchCalls: string[] = [];
		const httpImports: string[] = [];
		const zodImports: string[] = [];
		const queue = [entry];
		while (queue.length > 0) {
			const file = queue.pop() as string;
			if (files.has(file)) continue;
			files.add(file);
			const source = readFileSync(file, "utf-8");
			if (GLOBAL_FETCH.test(stripComments(source))) fetchCalls.push(path.relative(SRC, file));
			for (const match of source.matchAll(SPECIFIER)) {
				const specifier = match[1] ?? match[2] ?? match[3];
				if (isForbidden(specifier)) forbidden.push(`${path.relative(SRC, file)} -> ${specifier}`);
				if (ZOD_SPECIFIER.test(specifier)) zodImports.push(`${path.relative(SRC, file)} -> ${specifier}`);
				if (HTTP_BUILTIN.test(specifier)) httpImports.push(`${path.relative(SRC, file)} -> ${specifier}`);
				const next = resolveSource(specifier, file);
				if (next !== null) queue.push(next);
			}
		}
		return { files, forbidden, fetchCalls, httpImports, zodImports };
	}

	it("never reaches the MCP SDK, ink, react, yaml, the tools, the observer page or the status and kanban services", () => {
		const { files, forbidden } = walk(path.join(SRC, "cli/hook/index.ts"));

		// A walk that found nothing would pass vacuously.
		expect([...files].map((file) => path.relative(SRC, file).replace(/\\/g, "/"))).toContain(
			"service/observer/event/touchPresence/index.ts",
		);
		expect(forbidden).toEqual([]);
	});

	it("never calls the global fetch: the hook's one network call is event's pingObserver on node:http", () => {
		const { fetchCalls } = walk(path.join(SRC, "cli/hook/index.ts"));

		expect(fetchCalls).toEqual([]);
	});

	it("never statically imports node:http or node:https: load them with createRequire(import.meta.url)", () => {
		const { httpImports } = walk(path.join(SRC, "cli/hook/index.ts"));

		// The ESM namespace of node:http loads undici and worker_threads on every hook run (about 40 ms);
		// `createRequire(import.meta.url)("node:http")` (event's pingObserver) loads neither.
		expect(
			httpImports,
			"static import of node:http/node:https on the hook path: its ESM namespace loads undici and worker_threads on every hook run; use createRequire(import.meta.url)",
		).toEqual([]);
	});

	it("never has a runtime import of zod: the hook path is zod-free (brief commitment #150)", () => {
		const { files, zodImports } = walk(path.join(SRC, "cli/hook/index.ts"));

		// A walk that found nothing would pass vacuously.
		const reached = [...files].map((file) => path.relative(SRC, file).replace(/\\/g, "/"));
		expect(reached).toContain("service/observer/event/touchPresence/index.ts");
		expect(reached).toContain("service/observer/event/shared/presenceRecord/index.ts");
		expect(
			zodImports,
			"runtime import of zod on the hook path (brief #150: the hook path is zod-free; only `import type` from zod is allowed, and nothing on the path needs it): hand-write the contract instead",
		).toEqual([]);
	});
});
