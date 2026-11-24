import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import pageTitle from "@/observer/shared/pageTitle/index.js";
import Brand from "./index.js";

describe("Brand", () => {
	it("draws the hidden logo mark and the shared title copy", () => {
		expect(renderToStaticMarkup(<Brand />)).toBe(
			`<div class="av-brand"><span class="av-logo" aria-hidden="true">A</span>${pageTitle}</div>`,
		);
	});
});
