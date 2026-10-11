import type { BrainDraftFinding } from "@/types/index.js";

/**
 * Words the remediation for one draft finding. Composes only from the draft's
 * project-relative path and the finding, so the verdict is the same whatever the
 * host config says and never points at `aide_upgrade` or `/aide:brain config`,
 * which act on the host file rather than the draft.
 */
export default function composeDraftVerdict({
	relativePath,
	finding,
}: {
	relativePath: string;
	finding: BrainDraftFinding;
}): string {
	switch (finding.kind) {
		case "valid":
			return `\`${relativePath}\` passes the brain config's structural check: its frontmatter fields and every required section are in place, in contract order. It is ready to swap in as \`.aide/config/brain.aide\`; after the swap, re-check brain state with \`aide_info\`. The check is structural only; it does not judge what the sections say.`;
		case "absent":
			return `No file exists at \`${relativePath}\`. Write the draft there, or pass the path of the draft you wrote, then validate again.`;
		case "missing-sections":
			return `\`${relativePath}\` is missing required sections: ${finding.sections.join(", ")}. Write each one for this backend between its markers — \`aide_brain\` with \`source: "template"\` and that section as \`kind\` returns its purpose and the bundled template's version as an example — then validate the draft again.`;
		case "malformed":
			return `\`${relativePath}\` is malformed: ${finding.reason}. Fix it with the user at the place that reason names, then validate the draft again.`;
		default: {
			const unreachable: never = finding;
			throw new Error(`Unhandled draft finding: ${JSON.stringify(unreachable)}`);
		}
	}
}
