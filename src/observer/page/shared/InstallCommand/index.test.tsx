import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InstallCommand from "./index.js";

describe("InstallCommand", () => {
	it("draws the npx init command in the handoff's command box", () => {
		expect(renderToStaticMarkup(<InstallCommand />)).toBe('<div class="av-cmd">npx -y @aidemd-mcp/server@latest init</div>');
	});
});
