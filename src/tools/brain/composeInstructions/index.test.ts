import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/service/brainBackends/index.js");

import { getDriverById } from "@/service/brainBackends/index.js";
import composeInstructions from "./index.js";
import type { BrainState } from "@/types/index.js";

const mockGetDriverById = getDriverById as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOkState(vaultPath: string): BrainState {
	return { status: "ok", vaultPath, hints: [], backend: "obsidian" };
}

function makeNoMcpEntryState(): BrainState {
	return { status: "no-mcp-entry", vaultPath: null, hints: [], backend: null };
}

function makeInvalidPathState(path: string): BrainState {
	return { status: "invalid-path", vaultPath: path, hints: [], backend: null };
}

// ---------------------------------------------------------------------------
// Default driver stub — re-applied in beforeEach after vi.resetAllMocks()
// ---------------------------------------------------------------------------

const FAKE_PROSE = "<RENDERED_OBSIDIAN_PROSE>";

const fakeDriver = {
	id: "obsidian",
	renderInstructions: vi.fn().mockReturnValue(FAKE_PROSE),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("composeInstructions", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		// Re-apply default after reset so tests that don't override still have a driver.
		fakeDriver.renderInstructions.mockReturnValue(FAKE_PROSE);
		mockGetDriverById.mockReturnValue(fakeDriver);
	});

	// 6d.1 — ok branch
	it("ok branch: returns backend and rendered prose from the driver", () => {
		const state = makeOkState("/v");

		const result = composeInstructions(state);

		expect(result.backend).toBe("obsidian");
		expect(result.instructions).toBe(FAKE_PROSE);
		expect(fakeDriver.renderInstructions).toHaveBeenCalledWith({ vaultPath: "/v" });
		// 6d.5 — silent-success-forbidden
		expect(result.instructions.length).toBeGreaterThan(0);
	});

	// 6d.2 — no-mcp-entry branch
	it("no-mcp-entry branch: returns null backend with remediation prose", () => {
		const result = composeInstructions(makeNoMcpEntryState());

		expect(result.backend).toBeNull();
		expect(result.instructions).toContain("/aide:brain config");
		expect(result.instructions).toMatch(/surface this to the user/i);
		// 6d.5 — silent-success-forbidden
		expect(result.instructions.length).toBeGreaterThan(0);
	});

	// 6d.3 — invalid-path branch
	it("invalid-path branch: returns null backend with vault-path-specific remediation prose", () => {
		const result = composeInstructions(makeInvalidPathState("/old/vault"));

		expect(result.backend).toBeNull();
		expect(result.instructions).toContain("/aide:brain config");
		expect(result.instructions).toMatch(/vault path does not resolve/i);
		// 6d.5 — silent-success-forbidden
		expect(result.instructions.length).toBeGreaterThan(0);

		// Confirm the two branches produce distinct messages (6d.3)
		const noMcpResult = composeInstructions(makeNoMcpEntryState());
		expect(result.instructions).not.toBe(noMcpResult.instructions);
	});

	// 6d.4 — defensive contract: ok state with null vaultPath (step 5d)
	it("defensive contract: ok state with null vaultPath returns invalid-path shape (pins step 5d)", () => {
		// This is the impossible upstream state — buildBrainState guarantees
		// ok ⇒ vaultPath: string, but the helper must never return empty instructions.
		const impossibleState = { ...makeOkState("/v"), vaultPath: null } as unknown as BrainState;

		const result = composeInstructions(impossibleState);

		expect(result.backend).toBeNull();
		expect(result.instructions).toContain("/aide:brain config");
		// 6d.5 — silent-success-forbidden
		expect(result.instructions.length).toBeGreaterThan(0);
	});

	// 6d.5 — silent-success-forbidden covered inline in each branch above.
	// Additional invariant check: the no-mcp-entry prose must NOT contain vault-path language,
	// and the invalid-path prose must NOT contain no-mcp-entry-specific language.
	it("the two remediation branches produce distinct, non-overlapping prose", () => {
		const noMcpResult = composeInstructions(makeNoMcpEntryState());
		const invalidPathResult = composeInstructions(makeInvalidPathState("/p"));

		// no-mcp-entry does not say "vault path does not resolve"
		expect(noMcpResult.instructions).not.toMatch(/vault path does not resolve/i);
		// invalid-path does not say "no brain backend is wired"
		expect(invalidPathResult.instructions).not.toMatch(/no brain backend is wired/i);
	});
});
