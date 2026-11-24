import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Notice from "./index.js";

describe("Notice", () => {
	it.each([
		[undefined, 'class="av-notice"'],
		["default", 'class="av-notice"'],
		["calm", 'class="av-notice calm"'],
		["err", 'class="av-notice err"'],
	] as const)("tone %s writes %s", (tone, expected) => {
		const html = renderToStaticMarkup(
			<Notice tone={tone} icon="folder-off" iconSize="lg" heading="Heading" />,
		);
		expect(html).toContain(expected);
	});

	it("draws the icon at its size, the heading as h3 and the children after it", () => {
		const html = renderToStaticMarkup(
			<Notice icon="cloud-off" iconSize="xl" heading="Board can't load right now">
				<p>Reason</p>
			</Notice>,
		);
		expect(html).toBe(
			'<div class="av-notice"><span class="ic xl i-cloud-off" aria-hidden="true"></span><div><h3>Board can&#x27;t load right now</h3><p>Reason</p></div></div>',
		);
	});

	it("carries role=status only when asked", () => {
		expect(renderToStaticMarkup(<Notice role="status" icon="cloud-off" iconSize="lg" heading="x" />)).toContain('role="status"');
		expect(renderToStaticMarkup(<Notice icon="cloud-off" iconSize="lg" heading="x" />)).not.toContain("role=");
	});

	it("sets a style on the notice box only when given one", () => {
		expect(renderToStaticMarkup(<Notice tone="calm" style={{ marginTop: 24 }} icon="eye" iconSize="xl" heading="x" />)).toContain(
			'<div class="av-notice calm" style="margin-top:24px">',
		);
		expect(renderToStaticMarkup(<Notice icon="eye" iconSize="xl" heading="x" />)).not.toContain("style=");
	});
});
