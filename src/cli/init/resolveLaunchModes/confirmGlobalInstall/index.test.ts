import { describe, it, expect, vi, beforeEach } from "vitest";

const question = vi.fn();
const close = vi.fn();

vi.mock("node:readline/promises", () => ({
	createInterface: vi.fn(() => ({ question, close })),
}));

import confirmGlobalInstall from "./index.js";

let written: string;

beforeEach(() => {
	vi.clearAllMocks();
	written = "";
	vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
		written += String(chunk);
		return true;
	});
});

describe("confirmGlobalInstall", () => {
	it.each([
		["y", true],
		["Y", true],
		["yes", true],
		["YES", true],
		[" yes ", true],
		["", false],
		["n", false],
		["no", false],
		["yep", false],
	])("answer %j resolves %s", async (answer, expected) => {
		question.mockResolvedValueOnce(answer);
		expect(await confirmGlobalInstall("@scope/pkg", "npm i -g @scope/pkg")).toBe(expected);
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("prints the not-installed line and asks with the install command", async () => {
		question.mockResolvedValueOnce("n");
		await confirmGlobalInstall("@scope/pkg", "npm i -g @scope/pkg");
		expect(written).toContain("@scope/pkg is not installed globally.");
		expect(question).toHaveBeenCalledWith("Install it now with `npm i -g @scope/pkg`? [y/N]: ");
	});

	it("closes the interface when the prompt rejects", async () => {
		question.mockRejectedValueOnce(new Error("closed"));
		await expect(confirmGlobalInstall("p", "c")).rejects.toThrow("closed");
		expect(close).toHaveBeenCalledTimes(1);
	});
});
