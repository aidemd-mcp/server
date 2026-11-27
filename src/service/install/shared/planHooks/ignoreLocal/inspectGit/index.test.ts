import { describe, it, expect, vi, beforeEach } from "vitest";

type Outcome = { stdout: string } | { error: Error & { code?: unknown } };

const state = vi.hoisted(() => ({
	calls: [] as { args: string[]; options: unknown }[],
	outcomes: {} as Record<string, Outcome>,
}));

vi.mock("node:child_process", async () => {
	const { promisify } = await import("node:util");
	// Mirrors the real execFile's custom promisify shape: resolves { stdout, stderr }.
	const execFile = Object.assign(() => undefined, {
		[promisify.custom]: async (_file: string, args: string[], options: unknown) => {
			state.calls.push({ args, options });
			const outcome = state.outcomes[args[0]];
			if (outcome === undefined) throw new Error("outcome not configured");
			if ("error" in outcome) throw outcome.error;
			return { stdout: outcome.stdout, stderr: "" };
		},
	});
	return { execFile };
});

import inspectGit from "./index.js";

const PATH = ".claude/settings.local.json";

function failure(code: unknown): { error: Error & { code?: unknown } } {
	return { error: Object.assign(new Error("git failed"), { code }) };
}

beforeEach(() => {
	state.calls = [];
	state.outcomes = {};
});

describe("inspectGit", () => {
	it("reports ignored and untracked", async () => {
		state.outcomes["check-ignore"] = { stdout: "" };
		state.outcomes["ls-files"] = { stdout: "\n" };

		await expect(inspectGit({ projectRoot: "/p", path: PATH })).resolves.toEqual({ ignored: true, tracked: false });
	});

	it("reports not ignored and tracked", async () => {
		state.outcomes["check-ignore"] = failure(1);
		state.outcomes["ls-files"] = { stdout: `${PATH}\n` };

		await expect(inspectGit({ projectRoot: "/p", path: PATH })).resolves.toEqual({ ignored: false, tracked: true });
	});

	it("runs both git commands without a shell, in the project root, with a 5-second timeout", async () => {
		state.outcomes["check-ignore"] = { stdout: "" };
		state.outcomes["ls-files"] = { stdout: "" };

		await inspectGit({ projectRoot: "/p", path: PATH });

		expect(state.calls).toEqual([
			{ args: ["check-ignore", "--no-index", "-q", "--", PATH], options: { cwd: "/p", timeout: 5000 } },
			{ args: ["ls-files", "--", PATH], options: { cwd: "/p", timeout: 5000 } },
		]);
	});

	it("resolves null outside a work tree (check-ignore exit 128)", async () => {
		state.outcomes["check-ignore"] = failure(128);

		await expect(inspectGit({ projectRoot: "/p", path: PATH })).resolves.toBeNull();
		expect(state.calls).toHaveLength(1);
	});

	it("resolves null when git is missing", async () => {
		state.outcomes["check-ignore"] = failure("ENOENT");

		await expect(inspectGit({ projectRoot: "/p", path: PATH })).resolves.toBeNull();
	});

	it("resolves null when git times out", async () => {
		state.outcomes["check-ignore"] = failure(null);

		await expect(inspectGit({ projectRoot: "/p", path: PATH })).resolves.toBeNull();
	});

	it("resolves null when ls-files fails", async () => {
		state.outcomes["check-ignore"] = failure(1);
		state.outcomes["ls-files"] = failure(128);

		await expect(inspectGit({ projectRoot: "/p", path: PATH })).resolves.toBeNull();
	});
});
