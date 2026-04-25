import { describe, it, expect } from "vitest";

// No vi.mock needed — the registry is pure data and pure functions; there is
// nothing to mock at the module's own boundary.
import resolveBackend, { getDriverById } from "./index.js";
import type { McpServerEntry } from "./index.js";

// ─── Factory Functions ────────────────────────────────────────────────────────

function makePosixObsidianEntry(vaultPath: string = "/v"): McpServerEntry {
	return { command: "npx", args: ["@bitbonsai/mcpvault", vaultPath] };
}

function makeWindowsObsidianEntry(vaultPath: string = "/v"): McpServerEntry {
	return { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", vaultPath] };
}

function makeUnknownEntry(overrides?: Partial<McpServerEntry>): McpServerEntry {
	return { command: "npx", args: ["@some-org/notion-pkb-server", "ws-1"], ...overrides };
}

// ─── Matcher predicate tests (via resolveBackend public surface) ───────────────
//
// Per the spec: the predicate is called with the entry shape regardless of which
// mcpServers[<key>] name carries it. The registry never sees the key — matching
// is always determined by command/args shape alone, never by key name.
// (spec line: "Recognition is always determined by the entry's command/args shape.")

describe("resolveBackend — obsidian matcher predicate", () => {
	describe("positive matches", () => {
		it("POSIX obsidian entry resolves to the obsidian driver", () => {
			const driver = resolveBackend(makePosixObsidianEntry("/v"));

			expect(driver).not.toBeNull();
			expect(driver!.id).toBe("obsidian");
			expect(typeof driver!.renderInstructions).toBe("function");
		});

		it("Windows obsidian entry resolves to the obsidian driver", () => {
			const driver = resolveBackend(makeWindowsObsidianEntry("/v"));

			expect(driver).not.toBeNull();
			expect(driver!.id).toBe("obsidian");
			expect(typeof driver!.renderInstructions).toBe("function");
		});
	});

	describe("negative matches", () => {
		it("non-obsidian entry resolves to null", () => {
			expect(resolveBackend(makeUnknownEntry())).toBeNull();
		});
	});

	describe("bad-shape negatives — no throw, resolves to null", () => {
		it("command: npx, args: [] (empty args) → null, no throw", () => {
			const entry: McpServerEntry = { command: "npx", args: [] };
			expect(() => resolveBackend(entry)).not.toThrow();
			expect(resolveBackend(entry)).toBeNull();
		});

		it("command: npx, args: ['@bitbonsai/mcpvault'] (missing vault path positional — fails args.length >= 2 check) → null, no throw", () => {
			const entry: McpServerEntry = { command: "npx", args: ["@bitbonsai/mcpvault"] };
			expect(() => resolveBackend(entry)).not.toThrow();
			expect(resolveBackend(entry)).toBeNull();
		});

		it("command: cmd, args: ['/c', 'npx', '@bitbonsai/mcpvault'] (Windows shape missing trailing vault path — fails args.length >= 4 check) → null, no throw", () => {
			const entry: McpServerEntry = { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault"] };
			expect(() => resolveBackend(entry)).not.toThrow();
			expect(resolveBackend(entry)).toBeNull();
		});

		it("command: node, args: ['@bitbonsai/mcpvault', '/v'] (wrong command on POSIX path) → null, no throw", () => {
			const entry: McpServerEntry = { command: "node", args: ["@bitbonsai/mcpvault", "/v"] };
			expect(() => resolveBackend(entry)).not.toThrow();
			expect(resolveBackend(entry)).toBeNull();
		});

		it("command: npx, args: ['@bitbonsai/mcpvault-fork', '/v'] (close-but-wrong package name — strict-match rule from step 2b) → null, no throw", () => {
			const entry: McpServerEntry = { command: "npx", args: ["@bitbonsai/mcpvault-fork", "/v"] };
			expect(() => resolveBackend(entry)).not.toThrow();
			expect(resolveBackend(entry)).toBeNull();
		});

		it("command: npx, args: [42, '/v'] as non-string positional (defensive shape check — predicate must not throw) → null, no throw", () => {
			const entry: McpServerEntry = { command: "npx", args: [42, "/v"] as unknown as string[] };
			expect(() => resolveBackend(entry)).not.toThrow();
			expect(resolveBackend(entry)).toBeNull();
		});
	});
});

// ─── Rendered prose contract tests ───────────────────────────────────────────
//
// Uses `resolveBackend(makePosixObsidianEntry()).renderInstructions` to obtain
// the function — the public surface consumers call, not the internal template
// constant. Keeps the tests honest to the contract boundary.

describe("renderInstructions — obsidian prose contract", () => {
	// Obtain renderInstructions via the public accessor surface, never via a
	// direct import of the module-scope constant.
	const driver = resolveBackend(makePosixObsidianEntry());
	const renderInstructions = driver!.renderInstructions;

	it("produces non-empty prose for any vaultPath (pins silent-success-forbidden undesired outcome)", () => {
		const rendered = renderInstructions({ vaultPath: "/any/path" });
		expect(rendered.length).toBeGreaterThan(0);
	});

	it("names the brain-namespaced MCP read tool (mcp__brain__read_note)", () => {
		const rendered = renderInstructions({ vaultPath: "/v" });
		expect(rendered).toContain("mcp__brain__read_note");
	});

	it("does NOT name the obsidian-namespaced tool (handoff invariant: brain-class agents only ever see mcp__brain__*)", () => {
		const rendered = renderInstructions({ vaultPath: "/v" });
		expect(rendered).not.toMatch(/mcp__obsidian__/);
	});

	it("includes the resolved vault path verbatim, suffixed with /CLAUDE.md", () => {
		const rendered = renderInstructions({ vaultPath: "/Users/dev/my-brain" });
		expect(rendered).toContain("/Users/dev/my-brain/CLAUDE.md");
	});

	it("names the seeded entry-point file (CLAUDE.md)", () => {
		const rendered = renderInstructions({ vaultPath: "/v" });
		expect(rendered).toContain("CLAUDE.md");
	});

	it("does not duplicate seeded-file content (prose stops at the entry-point — no wikilink/crawling/folder/decision/write-rule enumeration)", () => {
		const rendered = renderInstructions({ vaultPath: "/v" });
		// Each keyword below is owned by the seeded CLAUDE.md, not by the driver's prose.
		// Enumerating them here would violate the spec's "prose stops at the entry-point" rule.
		expect(rendered).not.toContain("wikilink");
		expect(rendered).not.toContain("crawling protocol");
		expect(rendered).not.toContain("where to find");
		expect(rendered).not.toContain("folder structure");
		expect(rendered).not.toContain("decision protocol");
	});

	it("closes with a handoff sentence signalling the brain takes over (case-insensitive)", () => {
		const rendered = renderInstructions({ vaultPath: "/v" });
		expect(rendered).toMatch(/the brain takes over/i);
	});
});

// ─── getDriverById tests ──────────────────────────────────────────────────────
//
// `getDriverById` is the id-keyed view over the same MATCHERS table that
// `resolveBackend` walks. Tests below pin the id-lookup contract independently
// of the shape-based resolver so both accessors' contracts are explicit.

describe("getDriverById", () => {
	it("getDriverById('obsidian') returns the obsidian driver (id matches, renderInstructions is a function)", () => {
		const driver = getDriverById("obsidian");

		expect(driver).not.toBeNull();
		expect(driver!.id).toBe("obsidian");
		expect(typeof driver!.renderInstructions).toBe("function");
	});

	it("getDriverById('notion') returns null (unknown id today)", () => {
		expect(getDriverById("notion")).toBeNull();
	});

	it("getDriverById('') returns null (empty-string id, defensive lookup)", () => {
		expect(getDriverById("")).toBeNull();
	});

	it("getDriverById('OBSIDIAN') returns null (case-sensitive id lookup — id is a stable literal, never normalized)", () => {
		expect(getDriverById("OBSIDIAN")).toBeNull();
	});
});

// ─── Accessor-symmetry test ───────────────────────────────────────────────────
//
// Structural pin for the strategist's "two views over a single matcher table,
// not parallel registrations that can drift" decision (spec outcomes.undesired:
// "accessor inconsistency — resolveBackend and getDriverById returning different
// driver objects for the same backend"). If a future maintainer introduces a
// parallel Map, this test fails with a clear signal naming the symmetry rule.

it("accessor symmetry: resolveBackend(obsidianEntry) === getDriverById('obsidian') (reference equality, not deep equality)", () => {
	// Both accessors must return the exact same OBSIDIAN_DRIVER object reference —
	// the registry is one matcher table; two reads over it must yield one object.
	expect(resolveBackend(makePosixObsidianEntry()) === getDriverById("obsidian")).toBe(true);
});
