import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StepSource } from "@/observer/page/types/index.js";

vi.mock("@/observer/page/api/fetchFile/index.js", () => ({ default: vi.fn() }));

import fetchFile from "@/observer/page/api/fetchFile/index.js";
import useStepText from "./index.js";

const mockFetchFile = fetchFile as ReturnType<typeof vi.fn>;

const PLAN = ["### 1. Retire the old UI", "- [x] Delete components", "### 2. Types and routes", "- [ ] Add types"].join("\n");
const SOURCE: StepSource = { file: "src/a/plan.aide", step: 2 };

/** Mounts `useStepText` and exposes the latest value, re-rendering with a new source on demand. */
function mount(initial: StepSource | null) {
	const latest: { text: string | null | undefined } = { text: undefined };
	function Probe(props: { source: StepSource | null }) {
		latest.text = useStepText({ token: "tok", projectKey: "proj", source: props.source });
		return createElement(Text, null, String(latest.text));
	}
	const view = render(createElement(Probe, { source: initial }));
	return {
		view,
		rerender: (source: StepSource | null) => view.rerender(createElement(Probe, { source })),
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get text(): string | null {
			if (latest.text === undefined) throw new Error("hook did not run");
			return latest.text;
		},
	};
}

describe("useStepText", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("is null with no source and reads no file", async () => {
		const probe = mount(null);
		await probe.settle();
		expect(probe.text).toBeNull();
		expect(mockFetchFile).not.toHaveBeenCalled();
		probe.view.unmount();
	});

	it("is null while the plan loads, then the step's own words", async () => {
		mockFetchFile.mockResolvedValue({ ok: true, data: { path: SOURCE.file, text: PLAN } });
		const probe = mount(SOURCE);
		expect(probe.text).toBeNull();

		await probe.settle();
		expect(probe.text).toBe("Types and routes");
		expect(mockFetchFile).toHaveBeenCalledWith({ token: "tok", projectKey: "proj", path: "src/a/plan.aide" });
		probe.view.unmount();
	});

	it("is null when the read fails, never an error", async () => {
		mockFetchFile.mockResolvedValue({ ok: false, status: 404, message: "No such file" });
		const probe = mount(SOURCE);
		await probe.settle();
		expect(probe.text).toBeNull();
		probe.view.unmount();
	});

	it("is null when the plan has no such step", async () => {
		mockFetchFile.mockResolvedValue({ ok: true, data: { path: SOURCE.file, text: PLAN } });
		const probe = mount({ file: SOURCE.file, step: 9 });
		await probe.settle();
		expect(probe.text).toBeNull();
		probe.view.unmount();
	});

	it("reads the file once per file and step, and again when the step moves on", async () => {
		mockFetchFile.mockResolvedValue({ ok: true, data: { path: SOURCE.file, text: PLAN } });
		const probe = mount({ file: SOURCE.file, step: 1 });
		await probe.settle();
		expect(probe.text).toBe("Retire the old UI");

		probe.rerender({ file: SOURCE.file, step: 1 });
		await probe.settle();
		expect(mockFetchFile).toHaveBeenCalledTimes(1);

		probe.rerender(SOURCE);
		await probe.settle();
		expect(mockFetchFile).toHaveBeenCalledTimes(2);
		expect(probe.text).toBe("Types and routes");
		probe.view.unmount();
	});

	it("goes back to null when the source goes away", async () => {
		mockFetchFile.mockResolvedValue({ ok: true, data: { path: SOURCE.file, text: PLAN } });
		const probe = mount(SOURCE);
		await probe.settle();
		expect(probe.text).toBe("Types and routes");

		probe.rerender(null);
		await probe.settle();
		expect(probe.text).toBeNull();
		probe.view.unmount();
	});
});
