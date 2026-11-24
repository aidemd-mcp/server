import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StepBar from "./index.js";

describe("StepBar", () => {
	it("is one labelled image of done, running and empty segments in order", () => {
		const html = renderToStaticMarkup(<StepBar total={9} done={3} running={1} label="Step 4 of 9" />);
		expect(html).toBe(
			'<div class="av-steps" role="img" aria-label="Step 4 of 9" style="--n:9"><i class="d"></i><i class="d"></i><i class="d"></i><i class="r"></i><i></i><i></i><i></i><i></i><i></i></div>',
		);
	});

	it("sets the column count to the plan's step count", () => {
		const html = renderToStaticMarkup(<StepBar total={4} done={0} running={1} label="Step 1 of 4" />);
		expect(html).toContain('style="--n:4"');
		expect(html.match(/<i/g)).toHaveLength(4);
		expect(html.match(/class="r"/g)).toHaveLength(1);
	});

	it("draws every segment empty with nothing done or running", () => {
		const html = renderToStaticMarkup(<StepBar total={3} done={0} running={0} label="Step 0 of 3" />);
		expect(html).not.toContain('class="d"');
		expect(html).not.toContain('class="r"');
	});
});
