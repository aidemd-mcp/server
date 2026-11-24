import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WaitingFile } from "@/types/index.js";
import type { DrawerItem } from "@/observer/page/types/index.js";
import useSurfacedDrawer from "./index.js";

const waiting = (overrides: Partial<WaitingFile> = {}): WaitingFile => ({ file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 2, since: "2026-11-23T14:28:00.000Z", ...overrides });

type Props = { surfaced: WaitingFile | null; holdFirst: boolean; onOpen: (item: DrawerItem) => void };

/** Mounts `useSurfacedDrawer` and re-renders it with new props on demand. */
function mount(initial: Props) {
	function Probe(props: Props) {
		useSurfacedDrawer(props);
		return createElement(Text, null, "probe");
	}
	const view = render(createElement(Probe, initial));
	return {
		view,
		rerender: (next: Props) => view.rerender(createElement(Probe, next)),
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
	};
}

describe("useSurfacedDrawer", () => {
	it("opens the surfaced waiting file as a file detail", async () => {
		const onOpen = vi.fn();
		const probe = mount({ surfaced: waiting(), holdFirst: false, onOpen });
		await probe.settle();
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onOpen).toHaveBeenCalledWith({ kind: "file", path: "src/a/plan.aide" });
		probe.view.unmount();
	});

	it("opens nothing when no file is surfaced", async () => {
		const onOpen = vi.fn();
		const probe = mount({ surfaced: null, holdFirst: false, onOpen });
		await probe.settle();
		expect(onOpen).not.toHaveBeenCalled();
		probe.view.unmount();
	});

	it("does not open the same surfaced file again, so the user's own clicks stand", async () => {
		const onOpen = vi.fn();
		const probe = mount({ surfaced: waiting(), holdFirst: false, onOpen });
		await probe.settle();

		probe.rerender({ surfaced: waiting(), holdFirst: false, onOpen });
		await probe.settle();
		probe.rerender({ surfaced: waiting(), holdFirst: false, onOpen: vi.fn() });
		await probe.settle();
		expect(onOpen).toHaveBeenCalledTimes(1);
		probe.view.unmount();
	});

	it("opens again when a different file, or a later event for the same file, is surfaced", async () => {
		const onOpen = vi.fn();
		const probe = mount({ surfaced: waiting(), holdFirst: false, onOpen });
		await probe.settle();

		probe.rerender({ surfaced: waiting({ file: "src/b/todo.aide", seq: 3 }), holdFirst: false, onOpen });
		await probe.settle();
		probe.rerender({ surfaced: waiting({ file: "src/b/todo.aide", seq: 4 }), holdFirst: false, onOpen });
		await probe.settle();
		expect(onOpen.mock.calls.map(([item]) => item)).toEqual([
			{ kind: "file", path: "src/a/plan.aide" },
			{ kind: "file", path: "src/b/todo.aide" },
			{ kind: "file", path: "src/b/todo.aide" },
		]);
		probe.view.unmount();
	});

	it("opens the same file again after a gap with nothing surfaced", async () => {
		const onOpen = vi.fn();
		const probe = mount({ surfaced: waiting(), holdFirst: false, onOpen });
		await probe.settle();
		probe.rerender({ surfaced: null, holdFirst: false, onOpen });
		await probe.settle();
		probe.rerender({ surfaced: waiting(), holdFirst: false, onOpen });
		await probe.settle();
		expect(onOpen).toHaveBeenCalledTimes(2);
		probe.view.unmount();
	});

	it("with holdFirst, notes the first surfaced file without opening it, then opens every later change", async () => {
		const onOpen = vi.fn();
		const probe = mount({ surfaced: null, holdFirst: true, onOpen });
		await probe.settle();
		probe.rerender({ surfaced: waiting(), holdFirst: true, onOpen });
		await probe.settle();
		expect(onOpen).not.toHaveBeenCalled();

		probe.rerender({ surfaced: waiting({ file: "src/b/todo.aide", seq: 3 }), holdFirst: true, onOpen });
		await probe.settle();
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onOpen).toHaveBeenCalledWith({ kind: "file", path: "src/b/todo.aide" });
		probe.view.unmount();
	});
});
