import { describe, expect, it } from "vitest";
import type { ModuleRow } from "@/observer/page/types/index.js";
import mapChildren from "./index.js";

function makeModule(folder: string): ModuleRow {
	return {
		folder,
		label: folder,
		description: null,
		alignment: null,
		intentFile: null,
		brief: null,
		plan: null,
		todo: null,
		research: null,
		malformed: [],
	};
}

describe("mapChildren", () => {
	it("files each module under its longest prefix folder and top levels under the root", () => {
		const children = mapChildren({
			modules: [makeModule("."), makeModule("src"), makeModule("src/a"), makeModule("src/a/b"), makeModule("srcother")],
		});
		expect(children.get(".")?.map((m) => m.folder)).toEqual(["src", "srcother"]);
		expect(children.get("src")?.map((m) => m.folder)).toEqual(["src/a"]);
		expect(children.get("src/a")?.map((m) => m.folder)).toEqual(["src/a/b"]);
	});

	it("files top levels under null when there is no root row", () => {
		const children = mapChildren({ modules: [makeModule("src"), makeModule("src/a")] });
		expect(children.get(null)?.map((m) => m.folder)).toEqual(["src"]);
	});
});
