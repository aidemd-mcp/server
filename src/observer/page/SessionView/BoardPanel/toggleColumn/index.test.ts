import { describe, expect, it } from "vitest";
import toggleColumn from "./index.js";

describe("toggleColumn", () => {
	it("expands a capped column", () => {
		expect([...toggleColumn({ expanded: new Set(["done"]), column: "todo" })].sort()).toEqual(["done", "todo"]);
	});

	it("caps an expanded column again", () => {
		expect([...toggleColumn({ expanded: new Set(["done", "todo"]), column: "done" })]).toEqual(["todo"]);
	});

	it("leaves the set it was given as it was", () => {
		const before = new Set<"done">(["done"]);
		toggleColumn({ expanded: before, column: "done" });
		expect([...before]).toEqual(["done"]);
	});
});
