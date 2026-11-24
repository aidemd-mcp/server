import { describe, it, expect } from "vitest";
import toNodeFolder from "./index.js";

describe("toNodeFolder", () => {
	it.each([
		[".aide/intent.aide", "."],
		[".aide/session.aide", "."],
		[".aide/plan.aide", "."],
		["src/cli/.aide", "src/cli"],
		[".aide/config/brain.aide", ".aide/config"],
		["plan.aide", "."],
		["src\\cli\\.aide", "src/cli"],
	])("maps %s to %s", (file, folder) => {
		expect(toNodeFolder(file)).toBe(folder);
	});
});
