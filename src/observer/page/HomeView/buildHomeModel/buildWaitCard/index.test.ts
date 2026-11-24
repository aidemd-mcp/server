import { describe, expect, it } from "vitest";
import type { WaitingFile } from "@/types/index.js";
import buildWaitCard from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number): string => new Date(2026, 10, 23, hours, minutes).toISOString();
const PROJECT = { projectKey: "app-abc123", name: "app" };

function waiting(overrides: Partial<WaitingFile> = {}): WaitingFile {
	return { file: "src/a/plan.aide", folder: "src/a", kind: "plan", gate: "approve plan", sessionId: "s1", seq: 2, since: at(14, 28), ...overrides };
}

describe("buildWaitCard", () => {
	it("words the file, module, wait and start of one open gate", () => {
		const card = buildWaitCard({ token: "tok", project: PROJECT, waiting: waiting(), now: NOW });
		expect(card.file).toBe("plan.aide");
		expect(card.module).toBe("src/a");
		expect(card.since).toBe("6m");
		expect(card.at).toBe("14:28");
		expect(card.project).toBe("app");
	});

	it("keys the card by project, session and sequence", () => {
		expect(buildWaitCard({ token: "tok", project: PROJECT, waiting: waiting({ seq: 7 }), now: NOW }).key).toBe("app-abc123:s1:7");
	});

	it("links to the session with the waiting file's detail open", () => {
		const { href } = buildWaitCard({ token: "tok", project: PROJECT, waiting: waiting(), now: NOW });
		expect(href).toBe(`/p/app-abc123/s/s1?token=tok&item=${encodeURIComponent("file:src/a/plan.aide")}`);
	});

	it("reads the root module as the project's name", () => {
		const card = buildWaitCard({ token: "tok", project: PROJECT, waiting: waiting({ folder: ".", file: ".aide/intent.aide" }), now: NOW });
		expect(card.module).toBe("app");
		expect(card.file).toBe("intent.aide");
	});
});
