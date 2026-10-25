import type { CleanupRefusal, CleanupResult, OpenCheckbox } from "@/types/index.js";

type Report = { text: string; isError: boolean };

/** Renders `<module>/<file>`, or just `<file>` when the module is the project root. */
function formatPath(module: string, file: string): string {
	return module === "." ? file : `${module}/${file}`;
}

/** Renders the unchecked-item count line followed by one `<module>/<file>:<line>: <text>` line per item. */
function describeItems(module: string, items: OpenCheckbox[]): string[] {
	return [
		`${items.length} unchecked item${items.length === 1 ? "" : "s"} remain:`,
		...items.map((item) => `${formatPath(module, item.file)}:${item.line}: ${item.text}`),
	];
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
		case "no-ephemerals":
			return ["Reason: there is no plan.aide, todo.aide or brief.aide here to remove."];
		case "brief-without-plan":
			return [
				`Reason: ${formatPath(module, "brief.aide")} has no plan.aide beside it, and a brief is removed only together with its plan.`,
				...(refusal.items.length > 0 ? describeItems(module, refusal.items) : []),
			];
		case "todo-without-checkboxes":
			return [
				`Reason: ${formatPath(module, "todo.aide")} has no checkboxes to show its cycle closed, and there is no plan.aide here.`,
			];
		case "plan-without-checkboxes":
			return ["Reason: plan.aide has no checkboxes to verify, so completion cannot be shown."];
		case "open-status":
			return [
				...refusal.files.map(
					({ file, status }) =>
						`Reason: ${formatPath(module, file)} is recorded ${status}, so its cycle has not closed.`,
				),
				...(refusal.items.length > 0 ? describeItems(module, refusal.items) : []),
			];
		case "completed-with-open-items":
			return [
				"Reason: a file recorded completed still has unchecked items.",
				...describeItems(module, refusal.items),
			];
		case "invalid-status":
			return [
				`Reason: ${formatPath(module, refusal.file)} has a status cleanup cannot read: ${refusal.detail}.`,
			];
		case "unchecked-items": {
			const [count, ...lines] = describeItems(module, refusal.items);
			return [`Reason: ${count}`, ...lines];
		}
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
