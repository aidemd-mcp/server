import { describe, it, expect } from "vitest";
import type { InitStep } from "@/types/index.js";
import reportHooks from "./index.js";

const CWD = "/proj";

function makeStep(overrides: Partial<InitStep> & Pick<InitStep, "status" | "filePath">): InitStep {
	return { name: "Claude Code hooks", category: "hooks", ...overrides };
}

const local = (status: InitStep["status"], overrides: Partial<InitStep> = {}) =>
	makeStep({
		name: "Claude Code hooks (.claude/settings.local.json)",
		status,
		filePath: `${CWD}/.claude/settings.local.json`,
		...overrides,
	});
const project = (status: InitStep["status"], overrides: Partial<InitStep> = {}) =>
	makeStep({
		name: "AIDE hooks removed from shared settings (.claude/settings.json)",
		status,
		filePath: `${CWD}/.claude/settings.json`,
		...overrides,
	});
const gitignore = (status: InitStep["status"]) =>
	makeStep({ name: ".gitignore entry for .claude/settings.local.json", status, filePath: `${CWD}/.gitignore` });

describe("reportHooks", () => {
	it("reports nothing for no steps", () => {
		expect(reportHooks({ steps: [], cwd: CWD })).toEqual({ toApply: [], results: [], followUp: null });
	});

	it("applies a fresh project's one local would-create and logs it created", () => {
		const step = local("would-create", { content: "{}" });

		const report = reportHooks({ steps: [step], cwd: CWD });

		expect(report.toApply).toEqual([step]);
		expect(report.results).toEqual([
			{
				status: "created",
				displayPath: ".claude/settings.local.json",
				message: "Claude Code hooks (.claude/settings.local.json)",
			},
		]);
		expect(report.followUp).toBeNull();
	});

	it("applies local and gitignore creates together", () => {
		const steps = [local("would-create"), gitignore("would-create")];

		const report = reportHooks({ steps, cwd: CWD });

		expect(report.toApply).toEqual(steps);
		expect(report.results.map((r) => r.status)).toEqual(["created", "created"]);
		expect(report.followUp).toBeNull();
	});

	it("logs an already-wired local file as exists with nothing to apply", () => {
		const report = reportHooks({ steps: [local("exists")], cwd: CWD });

		expect(report.toApply).toEqual([]);
		expect(report.results).toEqual([
			{ status: "exists", displayPath: ".claude/settings.local.json", message: "already present" },
		]);
		expect(report.followUp).toBeNull();
	});

	it("holds the whole category when the .gitignore step is an overwrite", () => {
		const report = reportHooks({ steps: [local("would-create"), gitignore("would-overwrite")], cwd: CWD });

		expect(report.toApply).toEqual([]);
		expect(report.results).toEqual([
			{ status: "deferred", displayPath: ".claude/settings.local.json", message: "waits for /aide:upgrade — hooks category" },
			{ status: "deferred", displayPath: ".gitignore", message: "waits for /aide:upgrade — hooks category" },
		]);
		expect(report.followUp).toEqual({ kind: "merge" });
	});

	it("holds the whole category when the shared file must be stripped", () => {
		const report = reportHooks({ steps: [local("would-create"), project("would-overwrite")], cwd: CWD });

		expect(report.toApply).toEqual([]);
		expect(report.results.map((r) => [r.displayPath, r.status])).toEqual([
			[".claude/settings.local.json", "deferred"],
			[".claude/settings.json", "deferred"],
		]);
		expect(report.followUp).toEqual({ kind: "merge" });
	});

	it("keeps exists steps as exists while the rest of the category is held", () => {
		const report = reportHooks({ steps: [local("exists"), project("would-overwrite")], cwd: CWD });

		expect(report.results.map((r) => [r.displayPath, r.status])).toEqual([
			[".claude/settings.local.json", "exists"],
			[".claude/settings.json", "deferred"],
		]);
		expect(report.followUp).toEqual({ kind: "merge" });
	});

	it("reports one malformed file and names it", () => {
		const report = reportHooks({ steps: [project("would-skip", { configMalformed: true })], cwd: CWD });

		expect(report.toApply).toEqual([]);
		expect(report.results).toEqual([
			{ status: "skipped-malformed", displayPath: ".claude/settings.json", message: "not valid JSON — left unchanged" },
		]);
		expect(report.followUp).toEqual({ kind: "malformed", files: [".claude/settings.json"] });
	});

	it("names both files when both are malformed", () => {
		const steps = [local("would-skip", { configMalformed: true }), project("would-skip", { configMalformed: true })];

		const report = reportHooks({ steps, cwd: CWD });

		expect(report.results.map((r) => r.status)).toEqual(["skipped-malformed", "skipped-malformed"]);
		expect(report.followUp).toEqual({
			kind: "malformed",
			files: [".claude/settings.local.json", ".claude/settings.json"],
		});
	});

	it("defers the no-global step and carries the install command", () => {
		const step = local("would-skip", {
			globalPackage: { name: "@aidemd-mcp/server", installed: false, installCommand: "npm i -g @aidemd-mcp/server" },
		});

		const report = reportHooks({ steps: [step], cwd: CWD });

		expect(report.toApply).toEqual([]);
		expect(report.results).toEqual([
			{ status: "deferred", displayPath: ".claude/settings.local.json", message: "needs the global install — not written" },
		]);
		expect(report.followUp).toEqual({ kind: "global-install", installCommand: "npm i -g @aidemd-mcp/server" });
	});

	it("throws on a would-skip step that is neither malformed nor without the global install", () => {
		expect(() => reportHooks({ steps: [local("would-skip")], cwd: CWD })).toThrow(/Unexpected hooks step status/);
	});
});
