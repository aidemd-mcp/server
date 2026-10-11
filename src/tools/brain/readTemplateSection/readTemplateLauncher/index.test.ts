import { describe, it, expect } from "vitest";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import readTemplateLauncher from "./index.js";

function sliceFrontmatter(template: string): string {
	const openFence = template.indexOf("---");
	const yamlStart = template.indexOf("\n", openFence + 3) + 1;
	const closeBreak = template.indexOf("\n---", openFence + 3);
	return template.slice(yamlStart, closeBreak + 1);
}

describe("readTemplateLauncher", () => {
	it("equals the frontmatter region of the bundled template", () => {
		expect(readTemplateLauncher()).toBe(sliceFrontmatter(obsidianBrainAideTemplate()));
	});

	it("starts with the name field", () => {
		expect(readTemplateLauncher().startsWith("name:")).toBe(true);
	});

	it("contains the launcher definition", () => {
		expect(readTemplateLauncher()).toContain("mcpServerConfig:");
	});

	it("ends with the line break before the closing fence", () => {
		expect(readTemplateLauncher().endsWith("\n")).toBe(true);
	});

	it("contains no fence line and no section marker comment", () => {
		const launcher = readTemplateLauncher();
		expect(launcher.split("\n").some((line) => line.startsWith("---"))).toBe(false);
		expect(launcher).not.toContain("<!--");
	});

	it("returns identical strings across calls", () => {
		expect(readTemplateLauncher()).toBe(readTemplateLauncher());
	});
});
