import path from "node:path";
import type { HooksFollowUp, InitStep } from "@/types/index.js";
import type { InstallResult } from "../types/index.js";

/** The step's file as the per-file log prints it: relative to the project root, forward slashes. */
function toDisplayPath({ step, cwd }: { step: InitStep; cwd: string }): string {
	return path.relative(cwd, step.filePath).split(path.sep).join("/");
}

/**
 * Decides what `aide init` does with the hooks category: all of it or none of it.
 *
 * The CLI has no user to consent to an overwrite, and writing the local hooks while
 * AIDE's old entries stay in the shared settings file would run every hook twice. So
 * the category is applied only when every step is a plain create (or already present);
 * otherwise nothing in it is written and `followUp` says what the user runs next.
 * First match wins:
 *
 * 1. No steps: nothing to report.
 * 2. A `would-skip` step carrying `globalPackage` (no global install): that step is
 *    `deferred`; follow-up `global-install`.
 * 3. A `would-skip` step with `configMalformed`: each such step is `skipped-malformed`;
 *    follow-up `malformed` naming their files.
 * 4. Any `would-overwrite` step: every create and overwrite step is `deferred`, `exists`
 *    steps stay `exists`; follow-up `merge`.
 * 5. Otherwise every `would-create` step goes to `toApply` and logs `created`, `exists`
 *    steps log `exists`; no follow-up.
 *
 * Pure: reads no file and writes none. `results` are in the order of `steps`.
 */
export default function reportHooks({ steps, cwd }: { steps: InitStep[]; cwd: string }): {
	toApply: InitStep[];
	results: InstallResult[];
	followUp: HooksFollowUp | null;
} {
	const describe = (status: InstallResult["status"], message: (step: InitStep) => string) =>
		steps.map((step) => ({ status, displayPath: toDisplayPath({ step, cwd }), message: message(step) }));

	if (steps.length === 0) return { toApply: [], results: [], followUp: null };

	const withoutGlobal = steps.find((s) => s.status === "would-skip" && s.globalPackage !== undefined);
	if (withoutGlobal?.globalPackage) {
		return {
			toApply: [],
			results: describe("deferred", () => "needs the global install — not written"),
			followUp: { kind: "global-install", installCommand: withoutGlobal.globalPackage.installCommand },
		};
	}

	const malformed = steps.filter((s) => s.status === "would-skip" && s.configMalformed === true);
	if (malformed.length > 0) {
		return {
			toApply: [],
			results: malformed.map((step) => ({
				status: "skipped-malformed",
				displayPath: toDisplayPath({ step, cwd }),
				message: "not valid JSON — left unchanged",
			})),
			followUp: { kind: "malformed", files: malformed.map((step) => toDisplayPath({ step, cwd })) },
		};
	}

	if (steps.some((s) => s.status === "would-overwrite")) {
		return {
			toApply: [],
			results: steps.map((step) =>
				step.status === "exists"
					? { status: "exists", displayPath: toDisplayPath({ step, cwd }), message: "already present" }
					: {
							status: "deferred",
							displayPath: toDisplayPath({ step, cwd }),
							message: "waits for /aide:upgrade — hooks category",
						},
			),
			followUp: { kind: "merge" },
		};
	}

	const unexpected = steps.find((s) => s.status !== "would-create" && s.status !== "exists");
	if (unexpected) {
		throw new Error(`Unexpected hooks step status "${unexpected.status}" for ${unexpected.filePath}.`);
	}

	return {
		toApply: steps.filter((s) => s.status === "would-create"),
		results: steps.map((step) =>
			step.status === "exists"
				? { status: "exists", displayPath: toDisplayPath({ step, cwd }), message: "already present" }
				: { status: "created", displayPath: toDisplayPath({ step, cwd }), message: step.name },
		),
		followUp: null,
	};
}
