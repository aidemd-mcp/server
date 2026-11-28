import { describe, it, expect } from "vitest";
import { listReferencePages, readCanonicalDoc } from "@/service/install/initContent/index.js";
import listTools from "./index.js";

describe("listTools", () => {
	const tools = listTools();

	it("lists the names in the order the tools index links them", () => {
		const indexPage = readCanonicalDoc("reference/tools/index");
		const linked = [...indexPage.matchAll(/\]\(\.\/([^)]+?)\.md\)/g)].map((match) => match[1]);
		expect(tools.map((tool) => tool.name)).toEqual(linked);
	});

	it("covers every tools/ roster page except the index", () => {
		const stems = listReferencePages()
			.filter(({ hostPath }) => hostPath.startsWith("tools/") && hostPath !== "tools/index.md")
			.map(({ hostPath }) => hostPath.slice("tools/".length).replace(/\.md$/, ""));
		expect(new Set(tools.map((tool) => tool.name))).toEqual(new Set(stems));
	});

	it("lists no name twice", () => {
		const names = tools.map((tool) => tool.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every entry a non-empty single-line description", () => {
		for (const { description } of tools) {
			expect(description).not.toBe("");
			expect(description).not.toMatch(/[\r\n]/);
		}
	});
});
