import { describe, it, expect } from "vitest";
import findParentFolder from "./index.js";

describe("findParentFolder", () => {
	it("picks the longest ancestor", () => {
		expect(findParentFolder({ folder: "src/cli/tree", folders: [".", "src", "src/cli"] })).toBe("src/cli");
	});

	it("does not treat a name-sharing sibling as an ancestor", () => {
		expect(findParentFolder({ folder: "src/client", folders: [".", "src/cli"] })).toBe(".");
	});

	it("parents .aide/config to the root", () => {
		expect(findParentFolder({ folder: ".aide/config", folders: ["."] })).toBe(".");
	});

	it("returns null for the root", () => {
		expect(findParentFolder({ folder: ".", folders: [".", "src"] })).toBeNull();
	});

	it("returns null when there are no ancestors and no root", () => {
		expect(findParentFolder({ folder: "src/a", folders: ["lib", "src/a"] })).toBeNull();
	});
});
