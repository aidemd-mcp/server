import { afterEach, describe, expect, it, vi } from "vitest";
import parseSet from "./index.js";

afterEach(() => vi.restoreAllMocks());

describe("parseSet", () => {
	it("defaults to sessions", () => {
		expect(parseSet({ args: ["--port", "1"] })).toBe("sessions");
	});

	it.each(["sessions", "home", "home-many"])("accepts %s", (name) => {
		expect(parseSet({ args: ["--set", name] })).toBe(name);
	});

	it("refuses an unknown set with exit code 2, naming every set", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);

		expect(() => parseSet({ args: ["--set", "nope"] })).toThrow("exit");
		expect(process.exit).toHaveBeenCalledWith(2);
		expect(error).toHaveBeenCalledWith('--set must be sessions, home or home-many (got "nope").');
	});
});
