import type {
	CurrentValue,
	FrontmatterOutcome,
	FrontmatterRefusal,
	GovernedKind,
} from "../types/index.js";

/** Plain-language label for each governed file kind, used in refusal reasons. */
const KIND_LABELS: Record<GovernedKind, string> = {
	"intent-spec": "an intent spec",
	plan: "a plan",
	todo: "a todo list",
	brief: "a brief",
};

/** Value text for read lines: the value, `not set`, or `not valid ("<raw>")`. */
function describeReadValue(current: CurrentValue): string {
	if (current.state === "set") return current.value;
	if (current.state === "not-set") return "not set";
	return `not valid ("${current.raw}")`;
}

/** Value text for change and transition lines: the value, `not set`, or the raw text in quotes. */
function describeValue(current: CurrentValue): string {
	if (current.state === "set") return current.value;
	if (current.state === "not-set") return "not set";
	return `"${current.raw}"`;
}

/** Writes the reason (one line, or a header plus one line per item for open items) for one refusal, with the exact strings of the tool's report contract. */
function describeRefusal(refusal: FrontmatterRefusal, rel: string): string {
	switch (refusal.kind) {
		case "pairing":
			return "field and value go together; pass both to change a value, or neither to read";
		case "outside-root":
			return "the path resolves outside the project root";
		case "missing":
			return "no such file";
		case "not-a-file":
			return "not a regular file";
		case "not-aide":
			return "not an AIDE file; only .aide files carry governed values";
		case "ungoverned":
			if (refusal.which === "session") return "the session record carries no governed values";
			if (refusal.which === "research") return "a research spec carries no governed values";
			return "brain.aide is configuration and carries no governed values";
		case "unparsable":
			return `its frontmatter cannot be parsed (${refusal.detail})`;
		case "no-frontmatter":
			return `it has no frontmatter block to hold ${refusal.field}`;
		case "multi-line":
			return `its ${refusal.field} value spans more than one line, so it cannot be changed safely`;
		case "unknown-field":
			return `${refusal.field} is not a governed field; the governed fields are alignment (intent specs) and status (plans, todo lists and briefs)`;
		case "wrong-field":
			return `${KIND_LABELS[refusal.fileKind]} carries ${refusal.expected}, not ${refusal.field}`;
		case "ambiguous-alignment":
			return "it records alignment under both alignment and the older name status, so its alignment is ambiguous";
		case "invalid-value":
			return `${refusal.value} is not a ${refusal.field} value for ${KIND_LABELS[refusal.fileKind]}; allowed values: ${refusal.allowed.join(", ")}`;
		case "transition":
			return `${refusal.field} cannot move from ${describeValue(refusal.from)} to ${refusal.to}; allowed next values: ${refusal.allowed.join(", ")}`;
		case "final":
			return `${refusal.field} is ${refusal.value}, which is final; it cannot change`;
		case "open-items": {
			const count = refusal.items.length;
			const header = `completed is refused while ${count === 1 ? "1 item is" : `${count} items are`} unchecked:`;
			const lines = refusal.items.map((item) => `${rel}:${item.line}: ${item.text}`);
			return [header, ...lines].join("\n");
		}
		case "plan-not-completed":
			return `a brief is completed only after its plan; plan.aide beside it is ${refusal.plan}`;
	}
}

/**
 * Turns a `FrontmatterOutcome` into the tool's plain report text. `isError` is
 * true only for a refusal. Every line names the file by the outcome's `path`
 * (the root-relative POSIX path, or the caller's input path for a refusal that
 * happened before resolution).
 */
export default function formatResult(outcome: FrontmatterOutcome): {
	text: string;
	isError: boolean;
} {
	switch (outcome.kind) {
		case "read": {
			const suffix = outcome.legacy ? " (recorded under the older name status)" : "";
			return {
				text: `${outcome.path} — ${outcome.field}: ${describeReadValue(outcome.current)}${suffix}`,
				isError: false,
			};
		}
		case "changed": {
			const suffix = outcome.movedFromLegacy ? " (moved from the older name status)" : "";
			return {
				text: `${outcome.path} — ${outcome.field}: ${describeValue(outcome.from)} → ${outcome.to}${suffix}`,
				isError: false,
			};
		}
		case "unchanged":
			return {
				text: `${outcome.path} — ${outcome.field}: ${outcome.value} (no change)`,
				isError: false,
			};
		case "refused":
			return {
				text: `Refused: ${outcome.path} — ${describeRefusal(outcome.refusal, outcome.path)}`,
				isError: true,
			};
	}
}
