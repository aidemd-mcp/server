/**
 * The approved launch-mode wording shown wherever a user picks global or local.
 * `local` is for prompts about the aide server (`/aide:upgrade` moves its pin
 * forward); `localBrain` is for brain-specific prompts (`/aide:brain config`
 * moves that pin forward). One source keeps cli/init, brain.md and the aide_init
 * description from drifting.
 */
export default {
	global: {
		label: "Global (recommended)",
		explanation:
			"personal machine, reliable startup; stays on its installed version; one-time `npm i -g`.",
	},
	local: {
		label: "Local",
		explanation:
			"shared repos, cloud/CI; pinned to one version that /aide:upgrade moves forward; flaky cold start.",
	},
	localBrain: {
		label: "Local",
		explanation:
			"shared repos, cloud/CI; pinned to one version that /aide:brain config moves forward; flaky cold start.",
	},
} as const;
