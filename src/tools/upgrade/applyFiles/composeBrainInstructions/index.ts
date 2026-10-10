import type { UpgradeFileResult } from "@/types/index.js";

/**
 * Builds the apply-mode `instructions` for a brain file whose status is `differs`.
 * Each drift kind is named on its own sentence so the user sees exactly what
 * `/aide:brain config` will offer: missing required sections, sections whose text
 * is an outdated template version, and a legacy brain launcher. Sentences are
 * emitted in that order, only for the kinds present, joined by one space. Nothing
 * is written here — the sentences only point the agent at `/aide:brain config`.
 */
export default function composeBrainInstructions(file: UpgradeFileResult): string {
	const sentences: string[] = [];
	const missing = file.missingSections ?? [];
	const stale = file.staleSections ?? [];
	const legacy = file.legacyLauncher ?? [];
	if (missing.length > 0) {
		sentences.push(
			`Brain config is behind — missing required sections: ${missing.join(", ")}. Run /aide:brain config to add them.`,
		);
	}
	if (stale.length > 0) {
		sentences.push(
			`Brain config has sections whose text is an outdated template version: ${stale.join(", ")}. Run /aide:brain config to review each as its own before/after change.`,
		);
	}
	if (legacy.length > 0) {
		sentences.push(
			`Brain launcher is legacy (${legacy.join(", ")}). Run /aide:brain config to review the launcher change.`,
		);
	}
	return sentences.join(" ");
}
