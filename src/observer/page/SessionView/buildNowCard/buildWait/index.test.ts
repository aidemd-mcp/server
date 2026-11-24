import { describe, expect, it } from "vitest";
import type { WaitingFile } from "@/types/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import buildWait from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number): string => new Date(2026, 10, 23, hours, minutes).toISOString();

function waiting(overrides: Partial<WaitingFile> = {}): WaitingFile {
	return { file: "/work/app/src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 5, since: at(14, 28), ...overrides };
}

const status = makeStatus({ projectRoot: "/work/app" });

describe("buildWait", () => {
	it("is the amber card asking the user to approve the waiting file", () => {
		const card = buildWait({ status, events: [], waiting: waiting(), now: NOW });
		expect(card).toMatchObject({
			kind: "wait",
			state: "Waiting on you",
			icon: "wait",
			title: "Approve",
			titleMono: "plan.aide",
			sub: null,
			time: "6m",
			timeLabel: "waiting since 14:28",
			steps: null,
		});
		expect(card.hint).toBe("The agent is paused until you answer in its session. This page is read-only.");
	});

	it("names the module the file is for, and no writer when none reported finishing", () => {
		const card = buildWait({ status, events: [], waiting: waiting(), now: NOW });
		expect(card.parts).toEqual([{ label: "for", value: "src/a", mono: true }]);
	});

	it("reads the root module as the project's name", () => {
		const card = buildWait({ status, events: [], waiting: waiting({ folder: ".", file: "/work/app/.aide/intent.aide" }), now: NOW });
		expect(card.parts[0]).toEqual({ label: "for", value: "app", mono: true });
	});

	it("adds who wrote the file when a phase reported finishing that module before the gate opened", () => {
		const events = [makeEvent({ seq: 3, ts: at(14, 27), kind: "phase_finished", phase: "plan", agent: "aide-architect", module: "/work/app/src/a" })];
		const card = buildWait({ status, events, waiting: waiting(), now: NOW });
		expect(card.parts).toEqual([
			{ label: "for", value: "src/a", mono: true },
			{ label: "written by", value: "aide-architect", mono: true },
		]);
	});
});
