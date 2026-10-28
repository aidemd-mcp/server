import { describe, it, expect } from "vitest";
import planInstallInstruction from "./index.js";

describe("planInstallInstruction", () => {
	it("returns undefined when the package is installed", () => {
		const instruction = planInstallInstruction({ name: "example-pkg", installed: true, installCommand: "npm i -g example-pkg" });

		expect(instruction).toBeUndefined();
	});

	it("names the install command from the input when the package is not installed", () => {
		const instruction = planInstallInstruction({ name: "example-pkg", installed: false, installCommand: "npm i -g example-pkg" });

		expect(instruction).toBe(
			"The aide server is not installed globally. Run `npm i -g example-pkg` via Bash before merging this prescription. If the install fails, tell the user and do not merge the entry.",
		);
	});
});
