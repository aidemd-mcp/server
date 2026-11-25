import { describe, expect, it } from "vitest";
import pickKindIcon from "./index.js";

describe("pickKindIcon", () => {
	it.each([
		["Module", "folder"],
		["Task", "task"],
		["File", "file"],
		["Prompt · 14:03", "prompt"],
		["Commit", "commit"],
		["Release", "tag"],
		["Error", "error"],
		["QA verdict", "issues"],
		["Session started", "power"],
		["Waiting", "wait"],
		["Approved", "gate"],
		["Plan step", "step"],
	])("draws %s with the %s glyph", (kind, icon) => {
		expect(pickKindIcon(kind)).toBe(icon);
	});

	it("tells a finished phase from a started one", () => {
		expect(pickKindIcon("Phase finished")).toBe("done");
		expect(pickKindIcon("Phase started")).toBe("flag");
	});

	it("matches by the start of the word, so a suffix after the kind still counts", () => {
		expect(pickKindIcon("Module · todo")).toBe("folder");
	});

	it("is a document for any kind it does not know", () => {
		expect(pickKindIcon("Something else")).toBe("doc");
		expect(pickKindIcon("")).toBe("doc");
	});
});
