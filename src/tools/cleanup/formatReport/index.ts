import type { CleanupRefusal, CleanupResult } from "@/types/index.js";

type Report = { text: string; isError: boolean };

/** Renders `<module>/<file>`, or just `<file>` when the module is the project root. */
function formatPath(module: string, file: string): string {
	return module === "." ? file : `${module}/${file}`;
}

/** Turns one refusal into its reason lines; unchecked items get a count line plus one line per item. */
function describeRefusal(module: string, refusal: CleanupRefusal): string[] {
	switch (refusal.kind) {
		case "outside-root":
			return ["Reason: the path resolves outside the project root."];
		case "missing":
			return ["Reason: no such directory."];
		case "not-a-directory":
			return ["Reason: the path is not a directory."];
		case "not-a-file":
			return [`Reason: ${formatPath(module, refusal.file)} is not a regular file.`];
		case "no-plan":
			return ["Reason: no plan.aide, so the module's cycle cannot be shown closed."];
		case "plan-without-checkboxes":
			return [
				"Reason: plan.aide has no checkboxes to verify, so completion cannot be shown.",
				"Pass allowEmptyPlan: true only if the plan is intentionally empty.",
			];
		case "unchecked-items":
			return [
				`Reason: ${refusal.items.length} unchecked item${refusal.items.length === 1 ? "" : "s"} remain:`,
				...refusal.items.map((item) => `${formatPath(module, item.file)}:${item.line}: ${item.text}`),
			];
	}
}

/**
 * Renders a CleanupResult as the plain-text, one-line-per-action report the
 * tool returns to the agent. `isError` is true for every outcome that did not
 * fully do what was asked: a refusal or a partial removal.
 */
export default function formatReport(result: CleanupResult): Report {
	switch (result.kind) {
		case "removed":
			return {
				text: result.files.map((file) => `Removed ${formatPath(result.module, file)}`).join("\n"),
				isError: false,
			};
		case "would-remove":
			return {
				text: [
					"Dry run: nothing was removed. A real call would remove:",
					...result.files.map((file) => `Would remove ${formatPath(result.module, file)}`),
				].join("\n"),
				isError: false,
			};
		case "refused":
			return {
				text: [
					`Cleanup of ${result.module} was refused. Nothing was removed.`,
					...describeRefusal(result.module, result.refusal),
				].join("\n"),
				isError: true,
			};
		case "incomplete":
			return {
				text: [
					`Cleanup of ${result.module} did NOT complete. Error: ${result.error}`,
					...result.removed.map((file) => `Removed ${formatPath(result.module, file)}`),
					...result.remaining.map((file) => `Still present ${formatPath(result.module, file)}`),
				].join("\n"),
				isError: true,
			};
	}
}
