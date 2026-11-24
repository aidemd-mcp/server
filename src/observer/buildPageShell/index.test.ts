import { describe, expect, it } from "vitest";
import pageTitle from "../shared/pageTitle/index.js";
import buildPageShell from "./index.js";

describe("buildPageShell", () => {
	it("references both assets by their bare URL and echoes no token or other input", () => {
		const html = buildPageShell();

		expect(html).toContain('<link rel="stylesheet" href="/assets/page.css">');
		expect(html).toContain('<script type="module" src="/assets/page.js"></script>');
		expect(html).not.toContain("token");
		expect(html).not.toContain("?");
	});

	it("is a complete document with the root element and the page metadata", () => {
		const html = buildPageShell();

		expect(html.startsWith("<!doctype html>")).toBe(true);
		expect(html).toContain('<html lang="en">');
		expect(html).toContain('<meta charset="utf-8">');
		expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
		expect(html).toContain('<meta name="theme-color" content="#0D1117">');
		expect(html).toContain('<meta name="referrer" content="no-referrer">');
		expect(html).toContain(`<title>${pageTitle}</title>`);
		expect(html).toContain('<link rel="icon" href="data:,">');
		expect(html).toContain('<div id="root"></div>');
	});

	it("has no external URL, no style element and no inline script body", () => {
		const html = buildPageShell();

		expect(html).not.toContain("http");
		expect(html).not.toContain("<style");
		const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
		expect(scripts).toHaveLength(1);
		expect(scripts[0][1]).toBe("");
	});
});
