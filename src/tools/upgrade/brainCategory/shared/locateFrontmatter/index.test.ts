import { describe, it, expect } from "vitest";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import toLineEnding from "../toLineEnding/index.js";
import locateFrontmatter from "./index.js";

describe("locateFrontmatter", () => {
	it("locates the YAML region and body of an LF template", () => {
		const raw = obsidianBrainAideTemplate();
		const { yamlStart, yamlEnd, bodyStart } = locateFrontmatter(raw);

		const region = raw.slice(yamlStart, yamlEnd);
		expect(region.startsWith("name:")).toBe(true);
		expect(region.endsWith("\n")).toBe(true);
		expect(raw.slice(yamlEnd, bodyStart)).toBe("---\n");
		expect(raw.slice(bodyStart)).toBe(raw.slice(raw.indexOf("\n---\n") + 5));
	});

	it("locates the YAML region and body of a CRLF template", () => {
		const raw = toLineEnding({ text: obsidianBrainAideTemplate(), eol: "\r\n" });
		const { yamlStart, yamlEnd, bodyStart } = locateFrontmatter(raw);

		const region = raw.slice(yamlStart, yamlEnd);
		expect(region.startsWith("name:")).toBe(true);
		expect(region.endsWith("\r\n")).toBe(true);
		expect(raw.slice(yamlEnd, bodyStart)).toBe("---\r\n");
	});

	it("tolerates leading whitespace before the opening fence", () => {
		const raw = "\n\n---\nname: x\n---\nbody\n";
		const { yamlStart, yamlEnd, bodyStart } = locateFrontmatter(raw);

		expect(raw.slice(yamlStart, yamlEnd)).toBe("name: x\n");
		expect(raw.slice(bodyStart)).toBe("body\n");
	});

	it("puts bodyStart at raw.length when the closing fence is the last line", () => {
		const raw = "---\nname: x\n---";
		const { yamlStart, yamlEnd, bodyStart } = locateFrontmatter(raw);

		expect(raw.slice(yamlStart, yamlEnd)).toBe("name: x\n");
		expect(bodyStart).toBe(raw.length);
	});

	it("throws when there is no opening fence", () => {
		expect(() => locateFrontmatter("name: x\n")).toThrow();
	});

	it("throws when there is no closing fence", () => {
		expect(() => locateFrontmatter("---\nname: x\n")).toThrow();
	});
});
