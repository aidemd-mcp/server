import brainContract from "@/service/brainContract/index.js";
import launcherPurpose from "@/service/brainContract/launcherPurpose/index.js";
import { parseBundledTemplate } from "@/service/install/provisionBrain/index.js";
import type { BrainChangeTarget, BrainTemplateResult } from "@/types/index.js";
import readTemplateLauncher from "./readTemplateLauncher/index.js";

/**
 * Template read for `aide_brain` with `source: "template"`: returns the bundled
 * template's verbatim bytes for one contract section, or for the launcher, with
 * that part's purpose. An absent `kind` is the orientation section.
 *
 * The answer is independent of the host config: it takes no `root`, reads no
 * file and never calls `buildBrainState` or `parseBrainAide`. One section (or
 * the launcher) is returned per call, so an agent writing a config reads each
 * part as its own example rather than receiving the whole template at once.
 * The contract lookup is done here rather than through the sibling
 * `selectSection` / `sectionPurpose` helpers, which stay horizontally isolated;
 * the throw is an exhaustiveness guard for a marker that escaped the schema.
 */
export default function readTemplateSection({ kind }: { kind?: BrainChangeTarget }): BrainTemplateResult {
	const target = kind ?? "orientation";
	if (target === "launcher") return { template: readTemplateLauncher(), purpose: launcherPurpose };

	const entry = brainContract.find((candidate) => candidate.marker === target);
	if (!entry) throw new Error(`No brainContract entry for section marker "${target}"`);
	return { template: parseBundledTemplate()[entry.field], purpose: entry.purpose };
}
