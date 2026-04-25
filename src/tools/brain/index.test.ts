import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/service/buildBrainState/index.js");
vi.mock("./composeInstructions/index.js");

import buildBrainState from "@/service/buildBrainState/index.js";
import composeInstructions from "./composeInstructions/index.js";
import brain, { BrainInput } from "./index.js";

const mockBuildBrainState = buildBrainState as ReturnType<typeof vi.fn>;
const mockComposeInstructions = composeInstructions as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.resetAllMocks();
});

describe("brain", () => {
	it("forwards ok state verbatim", async () => {
		const state = { status: "ok" as const, vaultPath: "/v", hints: [], backend: "obsidian" };
		mockBuildBrainState.mockResolvedValue(state);
		mockComposeInstructions.mockReturnValue({ backend: "obsidian", instructions: "PROSE" });

		const result = await brain("/some/root");

		expect(result).toEqual({ status: "ok", backend: "obsidian", instructions: "PROSE" });
	});

	it("forwards no-mcp-entry state verbatim", async () => {
		const state = { status: "no-mcp-entry" as const, vaultPath: null, hints: [], backend: null };
		mockBuildBrainState.mockResolvedValue(state);
		mockComposeInstructions.mockReturnValue({ backend: null, instructions: "REMEDIATION" });

		const result = await brain("/some/root");

		expect(result).toEqual({ status: "no-mcp-entry", backend: null, instructions: "REMEDIATION" });
	});

	it("forwards invalid-path state verbatim", async () => {
		const state = { status: "invalid-path" as const, vaultPath: "/old/path", hints: [], backend: null };
		mockBuildBrainState.mockResolvedValue(state);
		mockComposeInstructions.mockReturnValue({ backend: null, instructions: "INVALID_PATH_PROSE" });

		const result = await brain("/some/root");

		expect(result).toEqual({ status: "invalid-path", backend: null, instructions: "INVALID_PATH_PROSE" });
	});

	it("calls composeInstructions with the exact BrainState returned by buildBrainState", async () => {
		const state = { status: "ok" as const, vaultPath: "/v", hints: [], backend: "obsidian" };
		mockBuildBrainState.mockResolvedValue(state);
		mockComposeInstructions.mockReturnValue({ backend: "obsidian", instructions: "PROSE" });

		await brain("/some/root");

		expect(mockComposeInstructions).toHaveBeenCalledWith(state);
	});

	it("calls buildBrainState with the root it received", async () => {
		const state = { status: "ok" as const, vaultPath: "/v", hints: [], backend: "obsidian" };
		mockBuildBrainState.mockResolvedValue(state);
		mockComposeInstructions.mockReturnValue({ backend: "obsidian", instructions: "PROSE" });

		await brain("/some/root");

		expect(mockBuildBrainState).toHaveBeenCalledWith("/some/root");
	});
});

describe("BrainInput", () => {
	it("parses empty object successfully — no parameters required", () => {
		const result = BrainInput.parse({});

		expect(result).toEqual({});
	});

	it("strips unexpected fields (passthrough is not configured)", () => {
		const result = BrainInput.parse({ unexpected: "value" });

		expect(result).toEqual({});
	});
});
