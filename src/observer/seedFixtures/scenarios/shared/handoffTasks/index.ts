/**
 * The handoff's tasks that more than one fixture names: the board lists them, and its sessions and timeline
 * pick them. Slug and title live here once so a rename reaches every place that shows the task.
 */
export default {
	rank: { slug: "aide-score-misaligned-rank", title: "aide_score ranks misaligned specs below unreviewed ones" },
	validate: {
		slug: "aide-validate-path-scope",
		title: "aide_validate with a path reports missing specs from the whole project",
	},
	reconnect: { slug: "viewer-reconnect", title: "Viewer reconnects after a server restart" },
	installRoot: { slug: "install-root-intent", title: "Install writes .aide/intent.aide when missing" },
	planSubsteps: { slug: "plan-substep-numbers", title: "Plan sub-steps (2a, 2b) keep their parent number" },
} as const;
