import type { BrainChangeTarget } from "@/types/index.js";

/** R9 (brief #17): the before text changed or is gone since the diff was shown. */
export default function changedSinceDiff(target: BrainChangeTarget): string {
	return `The \`${target}\` text changed after its diff was shown, so nothing was written. Fetch the diff again with \`aide_upgrade\`, \`category: "brain"\` and \`brainChange: "${target}"\` (no \`beforeHash\`), show it to the user, and apply only on their yes.`;
}
