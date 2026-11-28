import { describe, it, expect } from "vitest";
import renderToolsSection from "./index.js";

describe("renderToolsSection", () => {
	it("gives one line per tool in input order with the exact format", () => {
		const lines = renderToolsSection({
			tools: [
				{ name: "aide_read", description: "Reads a spec." },
				{ name: "aide_init", description: "Bootstraps AIDE." },
			],
		});

		expect(lines).toEqual([
			"- [`aide_read`](https://aidemd.dev/docs/tools/aide_read/) — Reads a spec.",
			"- [`aide_init`](https://aidemd.dev/docs/tools/aide_init/) — Bootstraps AIDE.",
		]);
	});

	it("passes a description with pipes, backticks, a period and .aide through byte-identical", () => {
		const description = "Reads `.aide` files | lists them. Done.";

		const [line] = renderToolsSection({ tools: [{ name: "aide_discover", description }] });

		expect(line).toBe(`- [\`aide_discover\`](https://aidemd.dev/docs/tools/aide_discover/) — ${description}`);
	});

	it("gives an empty array for an empty list", () => {
		expect(renderToolsSection({ tools: [] })).toEqual([]);
	});
});
