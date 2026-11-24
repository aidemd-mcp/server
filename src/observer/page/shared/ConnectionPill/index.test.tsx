import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ConnectionPill from "./index.js";

describe("ConnectionPill", () => {
	it.each([
		["live", "Live"],
		["idle", "Idle"],
		["recon", "Reconnecting"],
	] as const)("state %s shows its class, a hidden led and the word %s", (state, word) => {
		expect(renderToStaticMarkup(<ConnectionPill state={state} />)).toBe(
			`<span class="av-conn ${state}"><span class="led" aria-hidden="true"></span>${word}</span>`,
		);
	});
});
