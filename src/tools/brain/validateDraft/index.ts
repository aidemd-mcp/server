import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import classifyParseFailure from "@/service/buildBrainState/classifyParseFailure/index.js";
import type { BrainDraftResult } from "@/types/index.js";
import composeDraftVerdict from "./composeDraftVerdict/index.js";
import readDraft from "./readDraft/index.js";
import resolveDraftPath from "./resolveDraftPath/index.js";

/** Refusal wording for a path outside the project; deliberately does not echo the path. */
const OUTSIDE_PROJECT_PROSE =
	"The draft path is outside this project, so nothing was read. Pass a path inside the project.";

/**
 * Structural check of a draft brain config inside the project. Resolves the path
 * (refusing anything outside the project, symlinks included), reads the one draft
 * file, and runs the host check's own parser and parse-to-fault mapping over its
 * bytes, so the draft passes here exactly when the same bytes would pass once
 * swapped in as `.aide/config/brain.aide`. Read-only: reads at most the draft
 * file, never the host config or `.mcp.json`, and never calls `buildBrainState`.
 */
export default async function validateDraft({
	root,
	path,
}: {
	root: string;
	path: string;
}): Promise<BrainDraftResult> {
	const resolution = await resolveDraftPath({ root, path });
	if (resolution.kind === "outside") return { outcome: "refused", instructions: OUTSIDE_PROJECT_PROSE };
	if (resolution.kind === "absent") {
		return {
			outcome: "absent",
			instructions: composeDraftVerdict({ relativePath: resolution.relativePath, finding: { kind: "absent" } }),
		};
	}

	const { absolutePath, relativePath } = resolution;
	const draft = await readDraft({ absolutePath, relativePath });
	if (draft.kind === "absent") {
		return { outcome: "absent", instructions: composeDraftVerdict({ relativePath, finding: { kind: "absent" } }) };
	}
	if (draft.kind === "unreadable") {
		const fault = { kind: "malformed", reason: draft.reason } as const;
		return { outcome: "invalid", fault, instructions: composeDraftVerdict({ relativePath, finding: fault }) };
	}

	const parse = parseBrainAideFromString(draft.content);
	if (parse.kind === "ok") {
		return { outcome: "valid", instructions: composeDraftVerdict({ relativePath, finding: { kind: "valid" } }) };
	}

	const fault = classifyParseFailure(parse);
	if (fault === null) throw new Error(`Unreachable draft parse result: ${parse.kind}`);
	return { outcome: "invalid", fault, instructions: composeDraftVerdict({ relativePath, finding: fault }) };
}
