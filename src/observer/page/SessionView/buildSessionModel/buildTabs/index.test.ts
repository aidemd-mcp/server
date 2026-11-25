import { describe, expect, it } from "vitest";
import type { BoardModel, PlanRowModel, SessionRowModel, TreePanelModel } from "@/observer/page/types/index.js";
import buildTabs from "./index.js";

const tree = (misaligned: number): TreePanelModel => ({
	kind: "tree",
	entries: [],
	counts: { modules: 3, misaligned, openWork: 0 },
	initialCollapsed: [],
});
const board = (totals: number[]): BoardModel => ({
	kind: "board",
	countLine: "",
	columns: totals.map((total, index) => ({ id: "backlog", name: `c${index}`, total, tasks: [], cap: 8 })),
});
const plans = [{}, {}] as PlanRowModel[];
const sessions = [{}, {}, {}] as SessionRowModel[];
const countsOf = (tabs: ReturnType<typeof buildTabs>) => tabs.map((tab) => tab.count);

describe("buildTabs", () => {
	it("lists the five tabs in order, all but the intent tree phone-only", () => {
		const tabs = buildTabs({ tree: tree(0), plans, board: board([1]), sessions });
		expect(tabs.map((tab) => tab.id)).toEqual(["tree", "plans", "board", "sessions", "history"]);
		expect(tabs.filter((tab) => tab.phoneOnly).map((tab) => tab.id)).toEqual(["plans", "board", "sessions", "history"]);
	});

	it("counts misaligned modules (danger), plan rows, every board task and the sessions", () => {
		const tabs = buildTabs({ tree: tree(2), plans, board: board([4, 3, 128]), sessions });
		expect(countsOf(tabs)).toEqual(["2 misaligned", "2", "135", "3", null]);
		expect(tabs[0]).toMatchObject({ tone: "danger" });
	});

	it("shows no tree count when nothing is misaligned", () => {
		expect(buildTabs({ tree: tree(0), plans, board: board([1]), sessions })[0]!.count).toBeNull();
	});

	it("marks a failed board offline in danger", () => {
		const failed: BoardModel = { kind: "unavailable", tone: "err", heading: "h", text: "t", meta: null };
		const tab = buildTabs({ tree: tree(0), plans, board: failed, sessions })[2]!;
		expect(tab).toMatchObject({ count: "offline", tone: "danger" });
	});

	it("shows no count on the tabs a project with no reported folder cannot fill", () => {
		const calm: BoardModel = { kind: "unavailable", tone: "calm", heading: "h", text: "t", meta: null };
		const tabs = buildTabs({ tree: { kind: "unavailable" }, plans: null, board: calm, sessions });
		expect(countsOf(tabs)).toEqual([null, null, null, "3", null]);
	});
});
