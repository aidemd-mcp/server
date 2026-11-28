import { describe, it, expect } from "vitest";
import readPageFields from "./index.js";

const hostPath = "tools/aide_read.md";

describe("readPageFields", () => {
	it("reads name and description from an LF page", () => {
		const page = "---\nname: aide_read\ndescription: Reads one file.\n---\n\n# aide_read\n";
		expect(readPageFields({ hostPath, page })).toEqual({ name: "aide_read", description: "Reads one file." });
	});

	it("reads name and description from a CRLF page", () => {
		const page = "---\r\nname: aide_read\r\ndescription: Reads one file.\r\n---\r\n\r\n# aide_read\r\n";
		expect(readPageFields({ hostPath, page })).toEqual({ name: "aide_read", description: "Reads one file." });
	});

	it("loses only the trailing newline of a folded description", () => {
		const page = "---\nname: aide_read\ndescription: >\n  Reads one file, with `code` and a | pipe.\n---\n";
		expect(readPageFields({ hostPath, page }).description).toBe("Reads one file, with `code` and a | pipe.");
	});

	it.each([
		["no frontmatter", "# aide_read\n"],
		["missing name", "---\ndescription: Reads one file.\n---\n"],
		["missing description", "---\nname: aide_read\n---\n"],
		["name not matching the file stem", "---\nname: aide_other\ndescription: Reads one file.\n---\n"],
		["multi-line description", "---\nname: aide_read\ndescription: |\n  One.\n  Two.\n---\n"],
	])("refuses %s, naming the hostPath", (_label, page) => {
		expect(() => readPageFields({ hostPath, page })).toThrow(hostPath);
	});
});
