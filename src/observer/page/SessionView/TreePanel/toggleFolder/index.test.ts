import { describe, expect, it } from "vitest";
import toggleFolder from "./index.js";

describe("toggleFolder", () => {
	it("folds an open folder", () => {
		expect([...toggleFolder({ collapsed: new Set(["a"]), folder: "b" })].sort()).toEqual(["a", "b"]);
	});

	it("opens a folded folder", () => {
		expect([...toggleFolder({ collapsed: new Set(["a", "b"]), folder: "b" })]).toEqual(["a"]);
	});

	it("leaves the set it was given as it was", () => {
		const before = new Set(["a"]);
		toggleFolder({ collapsed: before, folder: "a" });
		expect([...before]).toEqual(["a"]);
	});
});
