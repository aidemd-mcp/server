import { describe, it, expect, vi, beforeEach } from "vitest";
import launchModeChoices from "@/service/install/shared/launchModeChoices/index.js";

const question = vi.fn();
const close = vi.fn();

vi.mock("node:readline/promises", () => ({
	createInterface: vi.fn(() => ({ question, close })),
}));

import askLaunchMode from "./index.js";

let written: string;

beforeEach(() => {
	vi.clearAllMocks();
	written = "";
	vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
		written += String(chunk);
		return true;
	});
});

describe("askLaunchMode", () => {
	it.each([
		["", "global"],
		["1", "global"],
		[" 1 ", "global"],
		["2", "local"],
	])("answer %j resolves %s", async (answer, expected) => {
		question.mockResolvedValueOnce(answer);
		expect(await askLaunchMode("aide")).toBe(expected);
		expect(question).toHaveBeenCalledTimes(1);
		expect(question).toHaveBeenCalledWith("Choose 1 or 2 [1]: ");
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("re-asks once on an unrecognized answer, then honors a valid one", async () => {
		question.mockResolvedValueOnce("maybe").mockResolvedValueOnce("2");
		expect(await askLaunchMode("aide")).toBe("local");
		expect(question).toHaveBeenCalledTimes(2);
	});

	it("resolves global after two unrecognized answers", async () => {
		question.mockResolvedValueOnce("x").mockResolvedValueOnce("y");
		expect(await askLaunchMode("aide")).toBe("global");
		expect(question).toHaveBeenCalledTimes(2);
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("closes the interface when the prompt rejects", async () => {
		question.mockRejectedValueOnce(new Error("closed"));
		await expect(askLaunchMode("aide")).rejects.toThrow("closed");
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("prints the header, the global choice and the aide local wording", async () => {
		question.mockResolvedValueOnce("1");
		await askLaunchMode("aide");
		expect(written).toContain("Launch mode for the aide MCP server:");
		expect(written).toContain(
			`[1] ${launchModeChoices.global.label} — ${launchModeChoices.global.explanation}`,
		);
		expect(written).toContain(
			`[2] ${launchModeChoices.local.label} — ${launchModeChoices.local.explanation}`,
		);
		expect(written).not.toContain(launchModeChoices.localBrain.explanation);
	});

	it("prints the localBrain wording for the brain server", async () => {
		question.mockResolvedValueOnce("1");
		await askLaunchMode("brain");
		expect(written).toContain("Launch mode for the brain MCP server:");
		expect(written).toContain(launchModeChoices.localBrain.explanation);
		expect(written).not.toContain(launchModeChoices.local.explanation);
	});
});
